/**
 * Restrained raster style: keep cities, suburbs, major roads; hide business POIs.
 * Used only when no Cloud Map ID is set so JSON styles still apply.
 */
export const GOOGLE_BASEMAP_STYLES: google.maps.MapTypeStyle[] = [
  {
    featureType: "poi",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ visibility: "simplified" }, { saturation: -45 }, { lightness: 18 }],
  },
  {
    featureType: "poi.park",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.attraction",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.medical",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.school",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "poi.sports_complex",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "landscape.man_made",
    elementType: "geometry",
    stylers: [{ visibility: "simplified" }, { lightness: 22 }],
  },
  {
    featureType: "road",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ saturation: -72 }, { lightness: 16 }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ saturation: -55 }, { lightness: 18 }],
  },
  {
    featureType: "road.local",
    elementType: "labels",
    stylers: [{ visibility: "simplified" }],
  },
  {
    featureType: "water",
    stylers: [{ saturation: -28 }, { lightness: 12 }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#4b5b6b" }],
  },
  {
    featureType: "administrative.neighborhood",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b7a88" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#f7f9fb" }, { weight: 2 }],
  },
];
