import { TextStyle } from "pixi.js";

export function createTextFieldStyle(scale: number): TextStyle {
  return new TextStyle({
    fontFamily: "Arial",
    fontSize: 36 * scale,
    fill: "#fff",
    stroke: "#0d2233",
    fontWeight: "bold",
    padding: 14 * scale,
    dropShadow: true,
    letterSpacing: 2 * scale,
    align: "center",
  });
}
