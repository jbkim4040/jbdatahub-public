import asyncio
from fastapi import APIRouter, Depends, HTTPException
import httpx
from config import settings
from middleware.admin_auth import require_roles

router = APIRouter()


async def _get_crumb(client: httpx.AsyncClient) -> dict:
    r = await client.get(
        f"{settings.jenkins_url}/crumbIssuer/api/json",
        auth=(settings.jenkins_user, settings.jenkins_password),
    )
    d = r.json()
    return {d["crumbRequestField"]: d["crumb"]}


@router.get("/builds")
async def list_builds(page: int = 1, limit: int = 10):
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{settings.jenkins_url}/job/{settings.jenkins_job}/api/json"
            f"?tree=builds[number,result,timestamp,duration,building]{{0,{limit * page}}}",
            auth=(settings.jenkins_user, settings.jenkins_password),
        )
    builds = r.json().get("builds", [])
    offset = (page - 1) * limit
    return {"items": builds[offset: offset + limit], "page": page}


@router.get("/builds/{build_number}")
async def get_build(build_number: int):
    async with httpx.AsyncClient(timeout=10) as client:
        detail, log = await asyncio.gather(
            client.get(
                f"{settings.jenkins_url}/job/{settings.jenkins_job}/{build_number}/api/json",
                auth=(settings.jenkins_user, settings.jenkins_password),
            ),
            client.get(
                f"{settings.jenkins_url}/job/{settings.jenkins_job}/{build_number}/consoleText",
                auth=(settings.jenkins_user, settings.jenkins_password),
            ),
        )
    d = detail.json()
    lines = log.text.splitlines()
    d["console_tail"] = "
".join(lines[-50:])
    return d


@router.post("/trigger")
async def trigger_deploy(_: str = Depends(require_roles("SUPER_ADMIN"))):
    async with httpx.AsyncClient(timeout=10) as client:
        crumb = await _get_crumb(client)
        r = await client.post(
            f"{settings.jenkins_url}/job/{settings.jenkins_job}/build",
            auth=(settings.jenkins_user, settings.jenkins_password),
            headers=crumb,
        )
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Jenkins returned {r.status_code}")
    return {"triggered": True}


@router.post("/security-scan")
async def trigger_security_scan(_: str = Depends(require_roles("ADMIN", "SUPER_ADMIN"))):
    async with httpx.AsyncClient(timeout=10) as client:
        crumb = await _get_crumb(client)
        r = await client.post(
            f"{settings.jenkins_url}/job/{settings.jenkins_security_job}/buildWithParameters"
            "?SKIP_DEPENDENCY_CHECK=false&SKIP_DAST=false&FAIL_ON_HIGH=false"
            f"&TARGET_URL={settings.target_url}",
            auth=(settings.jenkins_user, settings.jenkins_password),
            headers=crumb,
        )
    if r.status_code not in (200, 201):
        raise HTTPException(status_code=502, detail=f"Jenkins returned {r.status_code}")
    return {"triggered": True}


@router.get("/status")
async def deployment_status():
    active_slot = "unknown"
    try:
        proc = await asyncio.create_subprocess_exec(
            "ssh",
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "UserKnownHostsFile=/home/ubuntu/.ssh/known_hosts",
            "-i", settings.deploy_ssh_key,
            f"ubuntu@{settings.app_server_host}", "cat /home/ubuntu/bg-state.txt",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=3)
        active_slot = stdout.decode().strip() or "unknown"
    except Exception:
        pass

    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(
            f"{settings.jenkins_url}/job/{settings.jenkins_job}/lastBuild/api/json",
            auth=(settings.jenkins_user, settings.jenkins_password),
        )
    last = r.json() if r.status_code == 200 else {}
    return {
        "active_slot": active_slot,
        "last_build_number": last.get("number"),
        "last_build_result": last.get("result"),
        "last_build_building": last.get("building", False),
    }
