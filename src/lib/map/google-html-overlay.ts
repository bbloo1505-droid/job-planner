export type HtmlOverlayPane = "overlayMouseTarget" | "floatPane";

export type HtmlOverlayHandle = {
  element: HTMLElement;
  setPosition: (position: google.maps.LatLngLiteral) => void;
  setMap: (map: google.maps.Map | null) => void;
};

export function createHtmlOverlayClass(
  maps: google.maps.MapsLibrary,
  core: google.maps.CoreLibrary
): new (
  position: google.maps.LatLngLiteral,
  element: HTMLElement,
  pane?: HtmlOverlayPane
) => HtmlOverlayHandle & google.maps.OverlayView {
  return class HtmlOverlay extends maps.OverlayView {
    position: google.maps.LatLngLiteral;
    element: HTMLElement;
    private paneName: HtmlOverlayPane;

    constructor(
      position: google.maps.LatLngLiteral,
      element: HTMLElement,
      pane: HtmlOverlayPane = "overlayMouseTarget"
    ) {
      super();
      this.position = position;
      this.element = element;
      this.paneName = pane;
      this.element.style.position = "absolute";
      this.element.style.transform = "translate(-50%, -50%)";
    }

    onAdd(): void {
      const panes = this.getPanes();
      panes?.[this.paneName].appendChild(this.element);
    }

    draw(): void {
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(
        new core.LatLng(this.position.lat, this.position.lng)
      );
      if (!point) return;
      this.element.style.left = `${point.x}px`;
      this.element.style.top = `${point.y}px`;
    }

    onRemove(): void {
      this.element.remove();
    }

    setPosition(position: google.maps.LatLngLiteral): void {
      this.position = position;
      this.draw();
    }
  };
}
