from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_token: str
    github_repo: str = "jbkim4040/jb-workspace"
    claude_api_key: str = ""
    jenkins_url: str = "http://localhost:9090"
    jenkins_user: str = "jb-datahub-admin"
    jenkins_password: str
    jenkins_job: str = "jb-workspace"
    jenkins_security_job: str = "jb-workspace-security"

    # PostgreSQL (Server 5)
    db_host: str = "152.69.232.44"
    db_port: int = 5432
    db_name: str = "jbdatahub"
    db_user: str = "jbdatahub"
    db_password: str

    webhook_secret: str = ""
    app_host: str = "0.0.0.0"
    app_port: int = 8080

    @property
    def db_dsn(self) -> str:
        return f"postgresql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}"

    class Config:
        env_file = ".env"


settings = Settings()
