"""Add simulation_runs table for async job persistence and cache (D-04)."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "simulation_runs",
        sa.Column(
            "id",
            sa.UUID(),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("inputs", postgresql.JSONB(), nullable=False),
        sa.Column("inputs_hash", sa.Text(), nullable=False),
        sa.Column("outputs", postgresql.JSONB()),
        sa.Column("status", sa.Text(), nullable=False, server_default="PENDING"),
        sa.Column("physics_version", sa.Text(), nullable=False),
        sa.Column("charger_version", sa.Text(), nullable=False),
        sa.Column("duration_ms", sa.Integer()),
        sa.Column("error", postgresql.JSONB()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.create_index(
        "simulation_runs_inputs_hash_idx",
        "simulation_runs",
        ["inputs_hash"],
    )
    op.create_index(
        "simulation_runs_status_idx",
        "simulation_runs",
        ["status"],
    )


def downgrade() -> None:
    op.drop_index("simulation_runs_status_idx", table_name="simulation_runs")
    op.drop_index("simulation_runs_inputs_hash_idx", table_name="simulation_runs")
    op.drop_table("simulation_runs")
