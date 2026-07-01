.PHONY: valhalla-pbf valhalla-verify-pbf valhalla-status

valhalla-pbf:
	bash scripts/build_socal_pbf.sh

valhalla-verify-pbf:
	bash scripts/verify_valhalla_pbf.sh

valhalla-status:
	curl -s http://localhost:8002/status | (command -v jq >/dev/null 2>&1 && jq . || cat)
