"""Add truck_configs metadata columns for seed loader and API."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "truck_configs",
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )
    op.add_column("truck_configs", sa.Column("version", sa.Text()))
    op.add_column("truck_configs", sa.Column("source_notes", sa.Text()))
    op.create_unique_constraint(
        "uq_truck_configs_model_name",
        "truck_configs",
        ["model_name"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_truck_configs_model_name", "truck_configs", type_="unique")
    op.drop_column("truck_configs", "source_notes")
    op.drop_column("truck_configs", "version")
    op.drop_column("truck_configs", "is_active")
