import * as THREE from 'three'

/** The three hand-authored Shape definitions used by the production symbol. */
export function createTrionnShapes() {
  const builders: Array<(shape: THREE.Shape) => void> = [
    (shape) => {
      shape.moveTo(-0.140182, -0.2239285)
      shape.bezierCurveTo(-0.1261855, -0.2239285, -0.113243, -0.2163645, -0.106392, -0.204135)
      shape.lineTo(-0.0132215, -0.038037)
      shape.bezierCurveTo(0.001271, -0.0121985, -0.0174065, 0.0196695, -0.047027, 0.0196695)
      shape.lineTo(-0.4300165, 0.0196695)
      shape.bezierCurveTo(-0.4598385, 0.0196695, -0.478485, 0.0519715, -0.4635585, 0.07781)
      shape.lineTo(0.1073065, 1.065563)
      shape.bezierCurveTo(0.114111, 1.0773585, 0.114235, 1.0918665, 0.1076165, 1.1037705)
      shape.lineTo(0.013516, 1.2732165)
      shape.bezierCurveTo(-0.001116, 1.2995355, -0.0388585, 1.299861, -0.053909, 1.2737745)
      shape.lineTo(-0.7673585, 0.039029)
      shape.bezierCurveTo(-0.774287, 0.0270475, -0.7870900, 0.0196695, -0.8009315, 0.0196695)
      shape.lineTo(-1.2267785, 0.0196695)
      shape.bezierCurveTo(-1.2403875, 0.0196695, -1.2530045, 0.012539, -1.2600105, 0.000868)
      shape.lineTo(-1.359753, -0.16523)
      shape.bezierCurveTo(-1.375253, -0.191053, -1.356653, -0.2239285, -1.3265365, -0.2239285)
      shape.closePath()
    },
    (shape) => {
      shape.moveTo(0.655185, 0.5729575)
      shape.bezierCurveTo(0.648272, 0.584908, 0.648241, 0.5996175, 0.6551075, 0.611599)
      shape.lineTo(0.8809425, 1.005919)
      shape.bezierCurveTo(0.887685, 1.0176835, 0.887778, 1.0321295, 0.8811905, 1.043987)
      shape.lineTo(0.787028, 1.213526)
      shape.bezierCurveTo(0.772396, 1.239845, 0.7346535, 1.2401705, 0.7195875, 1.2140995)
      shape.lineTo(0.130789, 0.1955945)
      shape.bezierCurveTo(0.123876, 0.183644, 0.123845, 0.1689035, 0.1307425, 0.156922)
      shape.lineTo(0.2290435, -0.014322)
      shape.bezierCurveTo(0.243939, -0.0402845, 0.281418, -0.040269, 0.2962825, -0.0142755)
      shape.lineTo(0.470022, 0.2892765)
      shape.bezierCurveTo(0.4848865, 0.315239, 0.522319, 0.3152855, 0.5372455, 0.2893385)
      shape.lineTo(1.107289, -0.7013285)
      shape.bezierCurveTo(1.1142175, -0.713341, 1.1270205, -0.72075, 1.1408775, -0.72075)
      shape.lineTo(1.335604, -0.7207655)
      shape.bezierCurveTo(1.365426, -0.720781, 1.384088, -0.6884635, 1.369146, -0.662625)
      shape.closePath()
    },
    (shape) => {
      shape.moveTo(0.2825805, -0.599881)
      shape.bezierCurveTo(0.2973675, -0.625704, 0.2787055, -0.6578665, 0.2489455, -0.6578665)
      shape.lineTo(-0.900178, -0.6578665)
      shape.bezierCurveTo(-0.9137715, -0.6578665, -0.9263885, -0.665012, -0.9333945, -0.676668)
      shape.lineTo(-1.033137, -0.8427815)
      shape.bezierCurveTo(-1.0486525, -0.8686045, -1.030037, -0.9014645, -0.9999205, -0.9014645)
      shape.lineTo(0.433659, -0.9014645)
      shape.bezierCurveTo(0.4475625, -0.9014645, 0.460412, -0.90892, 0.4673095, -0.92101)
      shape.lineTo(0.691486, -1.31347)
      shape.bezierCurveTo(0.6983835, -1.3255445, 0.7112175, -1.333, 0.7251365, -1.333)
      shape.lineTo(0.9199715, -1.333)
      shape.bezierCurveTo(0.9497625, -1.333, 0.968409, -1.3007755, 0.9535755, -1.2749525)
      shape.lineTo(0.361491, -0.2442025)
      shape.bezierCurveTo(0.3545625, -0.232159, 0.3417595, -0.22475, 0.327887, -0.22475)
      shape.lineTo(0.1348655, -0.22475)
      shape.bezierCurveTo(0.1051055, -0.22475, 0.0864435, -0.2569125, 0.1012305, -0.2827355)
      shape.lineTo(0.2825805, -0.599881)
      shape.closePath()
    },
  ]

  return builders.map((build) => {
    const shape = new THREE.Shape()
    build(shape)
    return shape
  })
}
