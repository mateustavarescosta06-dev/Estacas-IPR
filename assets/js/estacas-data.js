/* Dados técnicos extraídos dos ábacos oficiais IPR (assets/docs/*.pdf).
   Unidades: dimensão e cobrimento em cm, área em cm², perímetro em cm,
   massa em kg/m, inércia em cm⁴, esforços em kN. */
window.IPR_ESTACAS = [
  { id: "C20", forma: "circular", nome: "Circular Ø 20", d: 20, barras: 6, aco: "6 Ø 4 mm CP-175 RB", area: 314, perimetro: 63, massa: 76, inercia: 7854, compMax: 539.6, compNbr: 402.2, tracaoMax: 83.9, cortante: "7,8 + t · 23,1", pdf: "Abaco-C20.pdf" },
  { id: "C23", forma: "circular", nome: "Circular Ø 23", d: 23, barras: 6, aco: "6 Ø 5 mm CP-175 RB", area: 415, perimetro: 72, massa: 101, inercia: 13737, compMax: 702.2, compNbr: 541.5, tracaoMax: 130.9, cortante: "8,9 + t · 31,1", pdf: "Abaco-C23.pdf" },
  { id: "C26", forma: "circular", nome: "Circular Ø 26", d: 26, barras: 6, aco: "6 Ø 5 mm CP-175 RB", area: 531, perimetro: 82, massa: 135, inercia: 22432, compMax: 918.1, compNbr: 721.7, tracaoMax: 130.9, cortante: "10,1 + t · 40,4", pdf: "Abaco-C26.pdf" },
  { id: "C30", forma: "circular", nome: "Circular Ø 30", d: 30, barras: 6, aco: "6 Ø 6 mm CP-175 RB", area: 707, perimetro: 94, massa: 171, inercia: 39761, compMax: 1213.6, compNbr: 978.1, tracaoMax: 189.5, cortante: "11,7 + t · 54,4", pdf: "Abaco-C30.pdf" },
  { id: "Q30", forma: "quadrada", nome: "Quadrada 30 × 30", d: 30, barras: 8, aco: "8 Ø 6 mm CP-175 RB", area: 900, perimetro: 120, massa: 235, inercia: 67500, compMax: 1537.2, compNbr: 1276.3, tracaoMax: 252.7, pdf: "Abaco-quadrado-30-x-30.pdf" },
  { id: "H17", forma: "hexagonal", nome: "Hexagonal Ø 17", d: 17, barras: 6, aco: "6 Ø 4 mm CP-175 RB", area: 188, perimetro: 51, massa: 47, inercia: 2825, compMax: 305.4, compNbr: 219.8, tracaoMax: 83.9, pdf: "Abaco-HC-170.pdf" },
  { id: "H21", forma: "hexagonal", nome: "Hexagonal Ø 21", d: 21, barras: 6, aco: "6 Ø 4 mm CP-175 RB", area: 286, perimetro: 63, massa: 69, inercia: 6579, compMax: 488.5, compNbr: 366.3, tracaoMax: 83.9, pdf: "Abaco-HC-210.pdf" },
  { id: "H28", forma: "hexagonal", nome: "Hexagonal Ø 28", d: 28, barras: 6, aco: "6 Ø 5 mm CP-175 RN", area: 509, perimetro: 84, massa: 123, inercia: 20793, compMax: 879.9, compNbr: 697.9, tracaoMax: 130.9, pdf: "Abaco-HC-280.pdf" },
  { id: "H33", forma: "hexagonal", nome: "Hexagonal Ø 33", d: 33, barras: 6, aco: "6 Ø 6 mm CP-175 RB", area: 707, perimetro: 99, massa: 171, inercia: 40119, compMax: 1214.3, compNbr: 991.4, tracaoMax: 189.5, pdf: "Abaco-HC-330.pdf" },
  { id: "HV40", forma: "hexagonal", nome: "Hexagonal Vazada 40", d: 40, furo: true, consulta: true },
  { id: "HV45", forma: "hexagonal", nome: "Hexagonal Vazada 45", d: 45, furo: true, consulta: true }
];
