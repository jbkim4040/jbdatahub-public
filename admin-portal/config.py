from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str
    github_repo: str = "jbkim4040/jb-workspace"
    claude_api_key: str
    jenkins_url: str = "http://localhost:9090"
    jenkins_user: str = "jb-datahub-admin"
    jenkins_password: str
    jenkins_job: str = "jb-workspace"
    jenkins_security_job: str = "jb-workspace-security"
    supabase_url: str
    supabase_key: str
    webhook_secret: str = ""
    app_host: str = "0.0.0.0"
    app_port: int = 8080

    class Config:
        env_file = ".env"


settings = Settings()
