import os
import ssl as ssl_mod

import asyncpg
from config import settings

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    if _pool is None:
        ssl_mode = os.environ.get("DB_SSL_MODE", "disable").lower()
        if ssl_mode == "require":
            ssl_ctx = ssl_mod.create_default_context()
            # 사설 CA 일 경우 verify_mode 조정 필요 — DB_SSL_VERIFY=false 로 disable 가능
            if os.environ.get("DB_SSL_VERIFY", "true").lower() == "false":
                ssl_ctx.check_hostname = False
                ssl_ctx.verify_mode = ssl_mod.CERT_NONE
        else:
            ssl_ctx = False  # disable
        _pool = await asyncpg.create_pool(
            host=settings.db_host,
            port=settings.db_port,
            user=settings.db_user,
            password=settings.db_password,
            database=settings.db_name,
            min_size=1,
            max_size=10,
            command_timeout=30,
            ssl=ssl_ctx,
        )


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("DB pool not initialized")
    return _pool
