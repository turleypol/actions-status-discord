import * as core from '@actions/core'
import * as github from '@actions/github'
import axios from 'axios'
const fs = require('fs')
interface StatusOption {
    status: string
    color: number
}

const statusOpts: Record<string, StatusOption> = {
    success: {
        status: 'Success',
        color: 0x28A745
    },
    failure: {
        status: 'Failure',
        color: 0xCB2431
    },
    cancelled: {
        status: 'Cancelled',
        color: 0xDBAB09
    }
}

async function run() {
    const nofail: boolean = core.getInput('nofail').trim().toLowerCase() == 'true'
    const webhook: string = core.getInput('webhook') || process.env.DISCORD_WEBHOOK || ''
    if (!webhook) {
        logError('No webhook endpoint is given', nofail)
        process.exit()
    }

    const status: string = core.getInput('status').toLowerCase()
    if (!(status in statusOpts)) {
        logError('Invalid status value', nofail)
        process.exit()
    }
    const description: string = core.getInput('description')
    const job: string = core.getInput('job')
    try {
        await axios.post(`${webhook}`, JSON.stringify(getPayload(status, description, job)),{
      headers: {
        'Content-Type': 'application/json',
        'X-GitHub-Event': process.env.GITHUB_EVENT_NAME,
      },
    },)
    } catch (err) {
        core.error(`Error :, ${err.response.status}, ${err.response.statusText}`);
        core.error('Message :'+ (err.response ? JSON.stringify(err.response.data) : err.message));
        logError(err, nofail)
    }
}

function logError(msg: string, nofail: boolean): void {
    nofail ? core.error(msg) : core.setFailed(msg)
}

function getPayload(status: string, description: string, job: string): object {
    const ctx = github.context
    const { owner, repo } = ctx.repo
    const { eventName, sha, ref, workflow, actor } = ctx
    const repoURL = `https://github.com/${owner}/${repo}`
    const workflowURL = `${repoURL}/commit/${sha}/checks`
    const sha_short = sha.substring(0,7)
    let blame = ""
    let blamea = ""
    const eventContent = fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')
    const jsonevent = JSON.parse(eventContent)
    if (status=="failure")
    {
        blame = jsonevent['sender']['login']
        blamea = jsonevent['sender']['avatar_url']
    }
    let commitmsg = ""
    if (jsonevent['head_commit'])
    {
      if (jsonevent['head_commit']['message'])
      {
        commitmsg=jsonevent['head_commit']['message']
      }
    }

    let payload = {
        embeds: [{
            title: statusOpts[status].status + (job ? `: ${job}` : ''),
            description: `Commit: [${sha_short}](${repoURL}/commit/${sha}) ${commitmsg}\nRef: ${ref}\n[Build](${workflowURL})`,
            color: statusOpts[status].color,
... blame && {footer:{'text':`Blame ${blame}!`, 'icon_url':blamea}}
        }],
        avatar_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
        username: 'GitHub'
    }

    core.debug(`payload: ${JSON.stringify(payload)}`)
    return payload
}

run()
