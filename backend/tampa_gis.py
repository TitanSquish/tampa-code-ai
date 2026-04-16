"""
City of Tampa GIS helpers (ArcGIS REST).

Authoritative sources (public):
- Address suggest / geocode: arcgis.tampagov.net Locators/SiteAddressLocator
- City limits: AdministrativeArea/MunicipalBoundary
- Zoning districts: gis.tpcmaps.org Rezoning/Zoning (TA Zoning layer)
- Overlays / historic: OpenData/Planning MapServer identify (selected layers)
- Parcel folio: Parcels/TaxParcel FeatureServer (envelope intersect + address match)

URLs can be overridden via environment variables (see CONFIG below).
"""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any
import requests

logger = logging.getLogger(__name__)

# --- Default public service URLs (override with env) ---
TAMPA_ARCGIS_BASE_URL = os.getenv(
    "TAMPA_ARCGIS_BASE_URL",
    "https://arcgis.tampagov.net/arcgis/rest/services",
)
# Site address geocoder (suggest + findAddressCandidates)
TAMPA_ADDRESS_GEOCODE_URL = os.getenv(
    "TAMPA_ADDRESS_GEOCODE_URL",
    f"{TAMPA_ARCGIS_BASE_URL}/Locators/SiteAddressLocator/GeocodeServer",
)
# Hillsborough / Tampa municipal boundary (point-in-polygon for City of Tampa)
TAMPA_CITY_LIMITS_LAYER_URL = os.getenv(
    "TAMPA_CITY_LIMITS_LAYER_URL",
    f"{TAMPA_ARCGIS_BASE_URL}/AdministrativeArea/MunicipalBoundary/FeatureServer/0",
)
# Official zoning map (TA Zoning) — use this for district code (ZONING field)
TAMPA_ZONING_LAYER_URL = os.getenv(
    "TAMPA_ZONING_LAYER_URL",
    "https://gis.tpcmaps.org/arcgis/rest/services/Rezoning/Zoning/MapServer/1",
)
# Planning map: historic + overlay districts (identify on sublayers)
TAMPA_PLANNING_MAP_URL = os.getenv(
    "TAMPA_PLANNING_MAP_URL",
    f"{TAMPA_ARCGIS_BASE_URL}/OpenData/Planning/MapServer",
)
# Parcels for folio
TAMPA_TAX_PARCEL_LAYER_URL = os.getenv(
    "TAMPA_TAX_PARCEL_LAYER_URL",
    f"{TAMPA_ARCGIS_BASE_URL}/Parcels/TaxParcel/FeatureServer/0",
)

# Historic local (1), Historic national (2), Overlay districts (3)
TAMPA_OVERLAY_IDENTIFY_LAYERS = os.getenv(
    "TAMPA_OVERLAY_IDENTIFY_LAYERS",
    "1,2,3",
)

REQUEST_TIMEOUT = float(os.getenv("TAMPA_GIS_REQUEST_TIMEOUT", "25"))

# Full map extent for identify (Web Mercator) — from TaxParcel MapServer fullExtent
TAMPA_MAP_EXTENT = os.getenv(
    "TAMPA_MAP_EXTENT",
    "-9226160,3189396,-9134256,3271051",
)


def _get(url: str, params: dict[str, Any]) -> dict[str, Any]:
    """GET JSON from ArcGIS REST; raises on HTTP errors."""
    r = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    r.raise_for_status()
    try:
        return r.json()
    except json.JSONDecodeError as e:
        raise ValueError("GIS response was not valid JSON") from e


def suggest_tampa_addresses(query: str) -> list[dict[str, Any]]:
    """
    Return autocomplete suggestions from Tampa SiteAddressLocator /suggest.
    Each item: label, address, magicKey, source (no coordinates until geocoded).
    """
    q = (query or "").strip()
    if len(q) < 3:
        return []

    url = f"{TAMPA_ADDRESS_GEOCODE_URL.rstrip('/')}/suggest"
    data = _get(
        url,
        {
            "f": "json",
            "text": q,
            "maxSuggestions": 10,
        },
    )
    out: list[dict[str, Any]] = []
    for s in data.get("suggestions") or []:
        text = (s.get("text") or "").strip()
        if not text:
            continue
        mk = s.get("magicKey") or ""
        out.append(
            {
                "label": text,
                "address": text,
                "magicKey": mk,
                "x": None,
                "y": None,
                "folio": None,
                "source": "tampa_gis",
            }
        )
    return out


def _find_address_candidates(
    single_line: str,
    magic_key: str | None = None,
    out_sr: int = 3857,
) -> list[dict[str, Any]]:
    url = f"{TAMPA_ADDRESS_GEOCODE_URL.rstrip('/')}/findAddressCandidates"
    params: dict[str, Any] = {
        "f": "json",
        "singleLine": single_line.strip(),
        "outSR": out_sr,
        "outFields": "*",
    }
    if magic_key:
        params["magicKey"] = magic_key
    data = _get(url, params)
    return list(data.get("candidates") or [])


def _find_address_candidates_2237(
    single_line: str,
    magic_key: str | None = None,
) -> list[dict[str, Any]]:
    url = f"{TAMPA_ADDRESS_GEOCODE_URL.rstrip('/')}/findAddressCandidates"
    params: dict[str, Any] = {
        "f": "json",
        "singleLine": single_line.strip(),
        "outSR": 2237,
        "outFields": "*",
    }
    if magic_key:
        params["magicKey"] = magic_key
    data = _get(url, params)
    return list(data.get("candidates") or [])


def is_inside_tampa_city_limits(x: float, y: float, in_sr: int = 2237) -> bool:
    """True if point intersects the Tampa municipal boundary polygon (NAME = Tampa)."""
    geom = json.dumps({"x": x, "y": y})
    url = f"{TAMPA_CITY_LIMITS_LAYER_URL.rstrip('/')}/query"
    data = _get(
        url,
        {
            "f": "json",
            "geometry": geom,
            "geometryType": "esriGeometryPoint",
            "inSR": in_sr,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "NAME,CODE",
            "returnGeometry": "false",
            "where": "NAME = 'Tampa'",
        },
    )
    for feat in data.get("features") or []:
        attrs = feat.get("attributes") or {}
        if (attrs.get("NAME") or "").strip().lower() == "tampa":
            return True
    return False


def get_zoning_for_point(x: float, y: float, in_sr: int = 2237) -> str | None:
    """Return zoning district code (e.g. RS-50, CBD-2) from TA Zoning layer."""
    geom = json.dumps({"x": x, "y": y})
    url = f"{TAMPA_ZONING_LAYER_URL.rstrip('/')}/query"
    data = _get(
        url,
        {
            "f": "json",
            "geometry": geom,
            "geometryType": "esriGeometryPoint",
            "inSR": in_sr,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "ZONING,DESCRIPTIO",
            "returnGeometry": "false",
        },
    )
    feats = data.get("features") or []
    if not feats:
        return None
    attrs = feats[0].get("attributes") or {}
    z = attrs.get("ZONING")
    return str(z).strip() if z else None


def _planning_overlay_labels_from_identify(results: list[dict[str, Any]]) -> list[str]:
    """Build human-readable overlay labels from MapServer identify results."""
    labels: list[str] = []
    seen: set[str] = set()
    for r in results:
        layer = (r.get("layerName") or "").strip()
        attrs = r.get("attributes") or {}
        if layer == "Historic District Local":
            name = attrs.get("HISTORIC_BNDY") or attrs.get("Historic_Bndy") or ""
            if name and str(name).lower() != "null":
                lab = f"Local historic: {name}"
        elif layer == "Historic Districts National":
            name = attrs.get("Historic_Bndy") or attrs.get("HISTORIC_BNDY") or ""
            if name and str(name).lower() != "null":
                lab = f"National historic: {name}"
        elif layer == "Overlay Districts":
            name = attrs.get("Name") or attrs.get("NAME") or ""
            if name and str(name).lower() != "null":
                lab = f"Overlay: {name}"
        else:
            continue
        lab = lab.strip()
        if lab and lab not in seen:
            seen.add(lab)
            labels.append(lab)
    return sorted(labels)


def get_overlays_for_point(x: float, y: float, in_sr: int = 3857) -> list[str]:
    """
    Historic + planning overlay districts at point (Planning MapServer identify).
    Uses sublayers 1 (local historic), 2 (national historic), 3 (overlay districts).
    """
    url = f"{TAMPA_PLANNING_MAP_URL.rstrip('/')}/identify"
    geom = json.dumps({"x": x, "y": y})
    params = {
        "f": "json",
        "geometry": geom,
        "geometryType": "esriGeometryPoint",
        "sr": in_sr,
        "layers": f"all:{TAMPA_OVERLAY_IDENTIFY_LAYERS}",
        "tolerance": "5",
        "mapExtent": TAMPA_MAP_EXTENT,
        "imageDisplay": "800,600,96",
        "returnGeometry": "false",
    }
    data = _get(url, params)
    return _planning_overlay_labels_from_identify(list(data.get("results") or []))


def _address_match_key(label: str) -> str:
    """Normalize '401 E Jackson St, T, 33602' -> '401 e jackson st'."""
    first = (label or "").split(",")[0].strip().lower()
    first = re.sub(r"\s+", " ", first)
    return first


def _folio_from_parcel_envelope(
    xmin: float,
    ymin: float,
    xmax: float,
    ymax: float,
    match_label: str,
) -> str | None:
    """Intersect parcels with geocode extent; pick row matching address label."""
    rings = [
        [
            [xmin, ymin],
            [xmax, ymin],
            [xmax, ymax],
            [xmin, ymax],
            [xmin, ymin],
        ]
    ]
    geom = json.dumps(
        {"rings": rings, "spatialReference": {"wkid": 3857}},
    )
    url = f"{TAMPA_TAX_PARCEL_LAYER_URL.rstrip('/')}/query"
    data = _get(
        url,
        {
            "f": "json",
            "geometry": geom,
            "geometryType": "esriGeometryPolygon",
            "inSR": 3857,
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "FOLIO,SITE_ADDR",
            "returnGeometry": "false",
        },
    )
    feats = data.get("features") or []
    if not feats:
        return None
    key = _address_match_key(match_label)
    for feat in feats:
        attrs = feat.get("attributes") or {}
        site = (attrs.get("SITE_ADDR") or "").strip()
        if site and _address_match_key(site) == key:
            folio = attrs.get("FOLIO")
            return str(folio).strip() if folio else None
    # Fallback: single parcel in envelope
    if len(feats) == 1:
        folio = feats[0].get("attributes", {}).get("FOLIO")
        return str(folio).strip() if folio else None
    return None


def get_tampa_property_context(
    address: str = "",
    x: float | None = None,
    y: float | None = None,
    magic_key: str | None = None,
) -> dict[str, Any]:
    """
    Resolve property context from GIS only (no LLM).

    Provide either (x, y) in Web Mercator (3857) or (address [+ magic_key]) to geocode.

    Returns keys:
      inside_city, error?, normalized_address, folio, zoning, overlays,
      future_land_use, source, x, y, spatial_reference
    """
    src = "city_of_tampa_gis"
    single_line = (address or "").strip()

    def _err(
        msg: str,
        *,
        inside: bool = False,
        norm: str | None = None,
        xo: float | None = None,
        yo: float | None = None,
    ) -> dict[str, Any]:
        return {
            "inside_city": inside,
            "error": msg,
            "normalized_address": norm,
            "folio": None,
            "zoning": None,
            "overlays": [],
            "future_land_use": None,
            "source": src,
            "x": xo,
            "y": yo,
            "spatial_reference": 3857 if xo is not None else None,
        }

    try:
        x3857: float | None = None
        y3857: float | None = None
        x2237: float
        y2237: float
        normalized: str | None = None
        extent: dict[str, float] | None = None

        if x is not None and y is not None:
            x3857, y3857 = float(x), float(y)
            x2237, y2237 = _project_point_to_2237(x3857, y3857)
            normalized = single_line or None
        else:
            if not single_line:
                return _err("Address or coordinates are required.")
            c2237 = _find_address_candidates_2237(single_line, magic_key)
            c3857 = _find_address_candidates(single_line, magic_key, out_sr=3857)
            if not c2237 or not c3857:
                return _err(
                    "Address could not be located in Tampa GIS.",
                    norm=single_line,
                )
            cand2237 = c2237[0]
            cand3857 = c3857[0]
            loc2237 = cand2237.get("location") or {}
            loc3857 = cand3857.get("location") or {}
            x3857 = float(loc3857["x"])
            y3857 = float(loc3857["y"])
            x2237 = float(loc2237["x"])
            y2237 = float(loc2237["y"])
            attrs = cand2237.get("attributes") or {}
            normalized = str(
                attrs.get("LongLabel")
                or attrs.get("Match_addr")
                or cand2237.get("address")
                or single_line
            ).strip()
            extent = cand3857.get("extent")

        if not is_inside_tampa_city_limits(x2237, y2237, in_sr=2237):
            return _err(
                "Address appears to be outside the City of Tampa.",
                norm=normalized or single_line or None,
                xo=x3857,
                yo=y3857,
            )

        zoning = get_zoning_for_point(x2237, y2237, in_sr=2237)
        if not zoning:
            return {
                "inside_city": True,
                "error": "Zoning could not be determined from GIS for this location.",
                "normalized_address": normalized or single_line or None,
                "folio": None,
                "zoning": None,
                "overlays": [],
                "future_land_use": None,
                "source": src,
                "x": x3857,
                "y": y3857,
                "spatial_reference": 3857,
            }

        overlays = get_overlays_for_point(x3857, y3857, in_sr=3857)

        folio: str | None = None
        if extent:
            folio = _folio_from_parcel_envelope(
                float(extent["xmin"]),
                float(extent["ymin"]),
                float(extent["xmax"]),
                float(extent["ymax"]),
                normalized or single_line,
            )
        elif single_line and x3857 is not None:
            dx = 40.0
            folio = _folio_from_parcel_envelope(
                x3857 - dx,
                y3857 - dx,
                x3857 + dx,
                y3857 + dx,
                single_line,
            )

        return {
            "inside_city": True,
            "error": None,
            "normalized_address": normalized or single_line or None,
            "folio": folio,
            "zoning": zoning,
            "overlays": overlays,
            "future_land_use": None,
            "source": src,
            "x": x3857,
            "y": y3857,
            "spatial_reference": 3857,
        }

    except requests.Timeout:
        logger.exception("Tampa GIS timeout")
        return _err("GIS request timed out. Try again.", norm=single_line or None)
    except (requests.RequestException, ValueError, KeyError, TypeError) as e:
        logger.exception("Tampa GIS error: %s", e)
        return _err("Could not load property data from Tampa GIS.", norm=single_line or None)


def _project_point_to_2237(x3857: float, y3857: float) -> tuple[float, float]:
    """Project Web Mercator point to Florida State Plane (EPSG:2237) using Esri geometry service."""
    url = "https://arcgis.tampagov.net/arcgis/rest/services/Utilities/Geometry/GeometryServer/project"
    params = {
        "f": "json",
        "inSR": 3857,
        "outSR": 2237,
        "geometries": json.dumps(
            {
                "geometryType": "esriGeometryPoint",
                "geometries": [{"x": x3857, "y": y3857}],
            }
        ),
    }
    data = _get(url, params)
    geoms = data.get("geometries") or []
    if not geoms:
        raise ValueError("Could not project coordinates to state plane for zoning lookup.")
    g = geoms[0]
    return float(g["x"]), float(g["y"])
