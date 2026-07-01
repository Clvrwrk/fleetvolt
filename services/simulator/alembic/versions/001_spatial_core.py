"""Spatial core schema — PostGIS extension and foundation tables."""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    op.create_table(
        "nhfn_network",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "geom",
            Geography(geometry_type="LINESTRING", srid=4326),
            nullable=False,
        ),
        sa.Column("phfs_flag", sa.Boolean()),
        sa.Column("corridor_type", sa.Text()),
        sa.Column("state", sa.Text()),
        sa.Column("name", sa.Text()),
        sa.Column("attributes", sa.dialects.postgresql.JSONB()),
        sa.Column("source", sa.Text()),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.execute("CREATE INDEX nhfn_network_geom_idx ON nhfn_network USING GIST (geom)")

    op.create_table(
        "chargers",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("station_id", sa.Text(), unique=True),
        sa.Column("name", sa.Text()),
        sa.Column(
            "geom",
            Geography(geometry_type="POINT", srid=4326),
            nullable=False,
        ),
        sa.Column("power_kw", sa.Numeric()),
        sa.Column("connector_types", sa.ARRAY(sa.Text())),
        sa.Column("operator", sa.Text()),
        sa.Column("address", sa.Text()),
        sa.Column("city", sa.Text()),
        sa.Column("state", sa.Text()),
        sa.Column("zip", sa.Text()),
        sa.Column("status", sa.Text()),
        sa.Column("is_mcs_capable", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("hd_capable", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("last_updated", sa.DateTime(timezone=True)),
        sa.Column("source", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )
    op.execute("CREATE INDEX chargers_geom_idx ON chargers USING GIST (geom)")
    op.create_index("chargers_power_idx", "chargers", ["power_kw"])

    op.create_table(
        "elevation_profiles",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("route_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("corridor_key", sa.Text()),
        sa.Column("profile", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("source", sa.Text()),
        sa.Column("resolution_m", sa.Numeric()),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "truck_configs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("model_name", sa.Text(), nullable=False),
        sa.Column("params", sa.dialects.postgresql.JSONB(), nullable=False),
        sa.Column("source", sa.Text()),
        sa.Column(
            "ingested_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "data_freshness",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("dataset_name", sa.Text(), nullable=False, unique=True),
        sa.Column("last_ingested_at", sa.DateTime(timezone=True)),
        sa.Column("row_count", sa.Integer()),
        sa.Column("source", sa.Text()),
    )


def downgrade() -> None:
    op.drop_table("data_freshness")
    op.drop_table("truck_configs")
    op.drop_table("elevation_profiles")
    op.drop_index("chargers_power_idx", table_name="chargers")
    op.execute("DROP INDEX IF EXISTS chargers_geom_idx")
    op.drop_table("chargers")
    op.execute("DROP INDEX IF EXISTS nhfn_network_geom_idx")
    op.drop_table("nhfn_network")
