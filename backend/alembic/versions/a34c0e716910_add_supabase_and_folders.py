"""add supabase workspaces folders payments and job ownership

Revision ID: a34c0e716910
Revises: 1d7de949a987
Create Date: 2026-05-31 11:03:14.537941

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a34c0e716910"
down_revision: Union[str, None] = "1d7de949a987"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    return table_name in sa.inspect(op.get_bind()).get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    if not _has_table(table_name):
        return False
    return column_name in {column["name"] for column in sa.inspect(op.get_bind()).get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("jobs", "workspace_id"):
        op.add_column("jobs", sa.Column("workspace_id", sa.String(), nullable=True))
    if not _has_column("jobs", "folder_id"):
        op.add_column("jobs", sa.Column("folder_id", sa.String(), nullable=True))

    bind = op.get_bind()
    indexes = {idx["name"] for idx in sa.inspect(bind).get_indexes("jobs")}
    if "ix_jobs_workspace_id" not in indexes:
        op.create_index(op.f("ix_jobs_workspace_id"), "jobs", ["workspace_id"], unique=False)
    if "ix_jobs_folder_id" not in indexes:
        op.create_index(op.f("ix_jobs_folder_id"), "jobs", ["folder_id"], unique=False)

    if not _has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("email", sa.String(), nullable=False),
            sa.Column("full_name", sa.String(), nullable=True),
            sa.Column("avatar_url", sa.String(), nullable=True),
            sa.Column("supabase_id", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email"),
            sa.UniqueConstraint("supabase_id"),
        )
        op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
        op.create_index(op.f("ix_users_email"), "users", ["email"], unique=False)
        op.create_index(op.f("ix_users_supabase_id"), "users", ["supabase_id"], unique=False)

    if not _has_table("workspaces"):
        op.create_table(
            "workspaces",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("owner_id", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_workspaces_id"), "workspaces", ["id"], unique=False)
        op.create_index(op.f("ix_workspaces_owner_id"), "workspaces", ["owner_id"], unique=False)

    if not _has_table("workspace_members"):
        op.create_table(
            "workspace_members",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("workspace_id", sa.String(), nullable=False),
            sa.Column("user_id", sa.String(), nullable=False),
            sa.Column("role", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_workspace_members_id"), "workspace_members", ["id"], unique=False)
        op.create_index(op.f("ix_workspace_members_user_id"), "workspace_members", ["user_id"], unique=False)
        op.create_index(op.f("ix_workspace_members_workspace_id"), "workspace_members", ["workspace_id"], unique=False)

    if not _has_table("folders"):
        op.create_table(
            "folders",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("workspace_id", sa.String(), nullable=False),
            sa.Column("parent_id", sa.String(), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(["parent_id"], ["folders.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(op.f("ix_folders_id"), "folders", ["id"], unique=False)
        op.create_index(op.f("ix_folders_parent_id"), "folders", ["parent_id"], unique=False)
        op.create_index(op.f("ix_folders_workspace_id"), "folders", ["workspace_id"], unique=False)

    if not _has_table("tenant_subscriptions"):
        op.create_table(
            "tenant_subscriptions",
            sa.Column("tenant_id", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("plan_type", sa.String(), nullable=True),
            sa.Column("customer_id", sa.String(), nullable=True),
            sa.Column("last_order_id", sa.String(), nullable=True),
            sa.Column("expires_at", sa.String(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.Column("updated_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("tenant_id"),
        )
        op.create_index(op.f("ix_tenant_subscriptions_tenant_id"), "tenant_subscriptions", ["tenant_id"], unique=False)
        op.create_index(op.f("ix_tenant_subscriptions_customer_id"), "tenant_subscriptions", ["customer_id"], unique=False)
        op.create_index(op.f("ix_tenant_subscriptions_last_order_id"), "tenant_subscriptions", ["last_order_id"], unique=False)

    if not _has_table("appmax_webhook_logs"):
        op.create_table(
            "appmax_webhook_logs",
            sa.Column("event_id", sa.String(), nullable=False),
            sa.Column("order_id", sa.String(), nullable=False),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("status", sa.String(), nullable=False),
            sa.Column("payload", sa.Text(), nullable=True),
            sa.Column("created_at", sa.String(), nullable=False),
            sa.PrimaryKeyConstraint("event_id"),
        )
        op.create_index(op.f("ix_appmax_webhook_logs_event_id"), "appmax_webhook_logs", ["event_id"], unique=False)
        op.create_index(op.f("ix_appmax_webhook_logs_order_id"), "appmax_webhook_logs", ["order_id"], unique=False)


def downgrade() -> None:
    for table in ["appmax_webhook_logs", "tenant_subscriptions", "folders", "workspace_members", "workspaces", "users"]:
        if _has_table(table):
            op.drop_table(table)
    if _has_column("jobs", "folder_id"):
        op.drop_index(op.f("ix_jobs_folder_id"), table_name="jobs")
        op.drop_column("jobs", "folder_id")
    if _has_column("jobs", "workspace_id"):
        op.drop_index(op.f("ix_jobs_workspace_id"), table_name="jobs")
        op.drop_column("jobs", "workspace_id")
