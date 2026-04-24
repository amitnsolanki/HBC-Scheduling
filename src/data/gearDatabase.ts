export interface RacketData {
  id: string;
  brand: string;
  model: string;
  series?: string;
  balance?: string;
  flex?: string;
  playing_style?: string;
  player_level?: string;
}

export interface ShoeData {
  id: string;
  brand: string;
  model: string;
  cushion_technology?: string;
  fit?: string;
  outsole?: string;
  player_level?: string;
}

export interface StringData {
  id: string;
  brand: string;
  model: string;
  gauge_mm?: string;
  material?: string;
  characteristic?: string;
  durability?: string;
}

export const RACKETS: RacketData[] = [
  { id: 'RAC-0001', brand: 'Yonex', model: 'Astrox 100ZZ', series: 'Astrox', balance: 'Head-Heavy', flex: 'Stiff', playing_style: 'Attack/Power', player_level: 'Professional' },
  { id: 'RAC-0002', brand: 'Yonex', model: 'Astrox 100ZX', series: 'Astrox', balance: 'Head-Heavy', flex: 'Stiff', playing_style: 'Attack/Power', player_level: 'Advanced' },
  { id: 'RAC-0004', brand: 'Yonex', model: 'Astrox 88D Pro', series: 'Astrox', balance: 'Head-Heavy', flex: 'Stiff', playing_style: 'Power Doubles', player_level: 'Professional' },
  { id: 'RAC-0005', brand: 'Yonex', model: 'Astrox 88S Pro', series: 'Astrox', balance: 'Head-Heavy', flex: 'Stiff', playing_style: 'Control Doubles', player_level: 'Professional' },
  { id: 'RAC-0008', brand: 'Yonex', model: 'Astrox 99 Pro', series: 'Astrox', balance: 'Head-Heavy', flex: 'Extra-Stiff', playing_style: 'Power Singles', player_level: 'Professional' },
  { id: 'RAC-0011', brand: 'Yonex', model: 'Astrox 77 Pro', series: 'Astrox', balance: 'Head-Heavy', flex: 'Medium', playing_style: 'Attack/Control', player_level: 'Advanced' },
  { id: 'RAC-0023', brand: 'Yonex', model: 'Arcsaber 11 Pro', series: 'Arcsaber', balance: 'Even-Balance', flex: 'Stiff', playing_style: 'Control', player_level: 'Professional' },
  { id: 'RAC-0026', brand: 'Yonex', model: 'Arcsaber 7 Pro', series: 'Arcsaber', balance: 'Even-Balance', flex: 'Stiff', playing_style: 'Control/Drive', player_level: 'Advanced' },
  { id: 'RAC-0032', brand: 'Yonex', model: 'Nanoflare 1000Z', series: 'Nanoflare', balance: 'Head-Light', flex: 'Extra-Stiff', playing_style: 'Speed/Drive', player_level: 'Professional' },
  { id: 'RAC-0037', brand: 'Yonex', model: 'Nanoflare 800 Pro', series: 'Nanoflare', balance: 'Head-Light', flex: 'Stiff', playing_style: 'Speed', player_level: 'Professional' },
  { id: 'RAC-0040', brand: 'Yonex', model: 'Nanoflare 700 Pro', series: 'Nanoflare', balance: 'Head-Light', flex: 'Stiff', playing_style: 'Drive/Speed', player_level: 'Advanced' },
  { id: 'RAC-0061', brand: 'Victor', model: 'Thruster Ryuga I', series: 'Thruster', balance: 'Head-Heavy', flex: 'Extra-Stiff', playing_style: 'Power Singles', player_level: 'Professional' },
  { id: 'RAC-0062', brand: 'Victor', model: 'Thruster Ryuga II', series: 'Thruster', balance: 'Head-Heavy', flex: 'Extra-Stiff', playing_style: 'Power Singles', player_level: 'Professional' },
  { id: 'RAC-0077', brand: 'Victor', model: 'Auraspeed 100X', series: 'Auraspeed', balance: 'Head-Light', flex: 'Stiff', playing_style: 'Speed', player_level: 'Professional' },
  { id: 'RAC-0088', brand: 'Victor', model: 'DriveX 10 Metallic', series: 'DriveX', balance: 'Even-Balance', flex: 'Stiff', playing_style: 'All-Round', player_level: 'Advanced' },
  { id: 'RAC-0097', brand: 'Victor', model: 'BraveSword 12 SE', series: 'BraveSword', balance: 'Even-Balance', flex: 'Stiff', playing_style: 'All-Round/Defense', player_level: 'Advanced' },
  { id: 'RAC-0109', brand: 'Li-Ning', model: 'Axforce 100', series: 'Axforce', balance: 'Head-Heavy', flex: 'Stiff', playing_style: 'Power', player_level: 'Professional' },
  { id: 'RAC-0117', brand: 'Li-Ning', model: 'BladeX 900 Max', series: 'BladeX', balance: 'Head-Light', flex: 'Extra-Stiff', playing_style: 'Speed', player_level: 'Professional' },
  { id: 'RAC-0123', brand: 'Li-Ning', model: 'Halbertec 9000', series: 'Halbertec', balance: 'Even-Balance', flex: 'Stiff', playing_style: 'All-Round', player_level: 'Advanced' },
  { id: 'RAC-0128', brand: 'Li-Ning', model: 'Tectonic 9', series: 'Tectonic', balance: 'Head-Heavy', flex: 'Stiff', playing_style: 'Power/Attack', player_level: 'Professional' },
  { id: 'RAC-0131', brand: 'Li-Ning', model: 'Tectonic 7', series: 'Tectonic', balance: 'Head-Heavy', flex: 'Medium', playing_style: 'Attack', player_level: 'Advanced' },
  { id: 'RAC-0145', brand: 'Mizuno', model: 'Fortius 11 Power', series: 'Fortius', balance: 'Head-Heavy', flex: 'Stiff', playing_style: 'Power', player_level: 'Advanced' },
  { id: 'RAC-0146', brand: 'Mizuno', model: 'Fortius 11 Quick', series: 'Fortius', balance: 'Head-Light', flex: 'Stiff', playing_style: 'Speed', player_level: 'Advanced' },
  { id: 'RAC-0219', brand: 'Yonex', model: 'Arcsaber 11', series: 'ArcSaber' },
  { id: 'RAC-0224', brand: 'Yonex', model: 'Astrox 100 ZZ', series: 'Astrox' },
  { id: 'RAC-0231', brand: 'Yonex', model: 'Astrox 88 D Pro', series: 'Astrox' },
  { id: 'RAC-0235', brand: 'Yonex', model: 'Astrox 88 S Pro', series: 'Astrox' },
  { id: 'RAC-0240', brand: 'Yonex', model: 'Nanoflare 1000 Z', series: 'Nanoflare' },
  { id: 'RAC-0245', brand: 'Yonex', model: 'Nanoflare 800 Pro', series: 'Nanoflare' },
  { id: 'RAC-0250', brand: 'Yonex', model: 'Nanoflare 700 Pro', series: 'Nanoflare' },
  { id: 'RAC-0255', brand: 'Victor', model: 'Thruster Ryuga Metallic', series: 'Thruster' },
  { id: 'RAC-0260', brand: 'Victor', model: 'Auraspeed 90K II', series: 'Auraspeed' },
  { id: 'RAC-0265', brand: 'Li-Ning', model: 'Axforce 90 Tiger', series: 'Axforce' },
  { id: 'RAC-0270', brand: 'Li-Ning', model: 'Axforce 90 Dragon', series: 'Axforce' },
];

export const SHOES: ShoeData[] = [
  { id: 'SHO-0001', brand: 'Yonex', model: 'Power Cushion 65 Z4', cushion_technology: 'Power Cushion + FLEXRON', fit: 'Gum + Lateral ', player_level: 'Advanced-Professional' },
  { id: 'SHO-0002', brand: 'Yonex', model: 'Power Cushion 65 Z3', cushion_technology: 'Power Cushion + Tough Gusset', fit: 'Round + Wide', player_level: 'Advanced' },
  { id: 'SHO-0009', brand: 'Yonex', model: 'Power Cushion 88 Dial', cushion_technology: 'Power Cushion + BOA Fit System', player_level: 'Advanced-Professional' },
  { id: 'SHO-0012', brand: 'Yonex', model: 'Power Cushion Infinity 3', cushion_technology: 'Power Cushion + INFUSED MIDSOLE', player_level: 'Professional' },
  { id: 'SHO-0016', brand: 'Yonex', model: 'Power Cushion Eclipsion Z4', cushion_technology: 'Power Cushion + FLEXRON', player_level: 'Advanced-Professional' },
  { id: 'SHO-0024', brand: 'Yonex', model: 'Power Cushion Aerus Z2', cushion_technology: 'Power Cushion Aerus', player_level: 'Advanced' },
  { id: 'SHO-0036', brand: 'Victor', model: 'A970 NitroLite', cushion_technology: 'NitroLite Nitrogen Foam + 3D Heel', player_level: 'Professional' },
  { id: 'SHO-0050', brand: 'Victor', model: 'P9600', cushion_technology: 'Carbon Power + ASYS', player_level: 'Professional' },
  { id: 'SHO-0051', brand: 'Victor', model: 'P9200 III', cushion_technology: 'HyperEVA + ASYS', player_level: 'Advanced-Professional' },
  { id: 'SHO-0059', brand: 'Victor', model: 'S82 III', cushion_technology: 'HyperEVA + Speed Design', player_level: 'Advanced-Professional' },
  { id: 'SHO-0071', brand: 'Li-Ning', model: 'BladeX DF-01 Max', cushion_technology: 'Cloud IV + Boom Damping', player_level: 'Professional' },
  { id: 'SHO-0101', brand: 'Mizuno', model: 'Wave Fang Pro 2', cushion_technology: 'Wave Plate + AP+ Midsole', player_level: 'Advanced-Professional' },
  { id: 'SHO-0116', brand: 'Asics', model: 'Gel-Blade 9', cushion_technology: 'GEL + FlyteFoam Propel', player_level: 'Advanced' },
  { id: 'SHO-0122', brand: 'Asics', model: 'Sky Elite FF 2', cushion_technology: 'FF Blast + DYNAWRAP', player_level: 'Advanced-Professional' },
  { id: 'SHO-0130', brand: 'Yonex', model: 'Power Cushion Comfort Z3', cushion_technology: 'Power Cushion + Snug Fit', player_level: 'Advanced' },
  { id: 'SHO-0140', brand: 'Victor', model: 'VG1', cushion_technology: 'Drop-in Midsole', player_level: 'Advanced' },
];

export const STRINGS: StringData[] = [
  { id: 'STR-0001', brand: 'Yonex', model: 'BG 65', gauge_mm: '0.7', characteristic: 'Durability', durability: 'High' },
  { id: 'STR-0002', brand: 'Yonex', model: 'BG 65 Titanium', gauge_mm: '0.7', characteristic: 'Durability', durability: 'High' },
  { id: 'STR-0003', brand: 'Yonex', model: 'BG 66 Ultimax', gauge_mm: '0.65', characteristic: 'Repulsion/Sound', durability: 'Medium' },
  { id: 'STR-0004', brand: 'Yonex', model: 'BG 66 Force', gauge_mm: '0.65', characteristic: 'Repulsion/Control', durability: 'Medium' },
  { id: 'STR-0008', brand: 'Yonex', model: 'BG 80', gauge_mm: '0.68', characteristic: 'Control/Feel', durability: 'Medium' },
  { id: 'STR-0009', brand: 'Yonex', model: 'BG 80 Power', gauge_mm: '0.68', characteristic: 'Control/Power', durability: 'Medium' },
  { id: 'STR-0014', brand: 'Yonex', model: 'Aerobite', gauge_mm: '0.67', characteristic: 'Control', durability: 'Medium' },
  { id: 'STR-0015', brand: 'Yonex', model: 'Aerobite Boost', gauge_mm: '0.67/0.61', characteristic: 'Control/Power', durability: 'Medium' },
  { id: 'STR-0016', brand: 'Yonex', model: 'Exbolt 63', gauge_mm: '0.63', characteristic: 'Repulsion/Sound', durability: 'Low-Medium' },
  { id: 'STR-0017', brand: 'Yonex', model: 'Exbolt 65', gauge_mm: '0.65', characteristic: 'Repulsion/Control', durability: 'Low-Medium' },
  { id: 'STR-0018', brand: 'Yonex', model: 'Exbolt 68', gauge_mm: '0.68', characteristic: 'Repulsion/Durability', durability: 'Medium' },
  { id: 'STR-0019', brand: 'Yonex', model: 'Aerosonic', gauge_mm: '0.61', characteristic: 'Repulsion', durability: 'Low' },
  { id: 'STR-0023', brand: 'Victor', model: 'VBS-66N', gauge_mm: '0.66', characteristic: 'Repulsion', durability: 'Medium' },
  { id: 'STR-0024', brand: 'Victor', model: 'VBS-68', gauge_mm: '0.68', characteristic: 'Durability', durability: 'High' },
  { id: 'STR-0043', brand: 'Li-Ning', model: 'No.1', gauge_mm: '0.65', characteristic: 'Repulsion', durability: 'Low' },
  { id: 'STR-0044', brand: 'Li-Ning', model: 'No.5', gauge_mm: '0.69', characteristic: 'Durability', durability: 'High' },
  { id: 'STR-0058', brand: 'Ashaway', model: 'ZyMax 66 Fire', gauge_mm: '0.66', characteristic: 'Repulsion/Power', durability: 'Medium' },
  { id: 'STR-0068', brand: 'Gosen', model: 'G-Tone 5', gauge_mm: '0.65', characteristic: 'Repulsion', durability: 'Medium' },
  { id: 'STR-0069', brand: 'Gosen', model: 'G-Tone 9', gauge_mm: '0.69', characteristic: 'Durability', durability: 'High' },
];

// Helper to search
export const searchRackets = (query: string) => {
  const q = query.toLowerCase();
  return RACKETS.filter(r => 
    r.model.toLowerCase().includes(q) || 
    r.brand.toLowerCase().includes(q) ||
    `${r.brand} ${r.model}`.toLowerCase().includes(q)
  ).slice(0, 10);
};

export const searchShoes = (query: string) => {
  const q = query.toLowerCase();
  return SHOES.filter(s => 
    s.model.toLowerCase().includes(q) || 
    s.brand.toLowerCase().includes(q) ||
    `${s.brand} ${s.model}`.toLowerCase().includes(q)
  ).slice(0, 10);
};

export const searchStrings = (query: string) => {
  const q = query.toLowerCase();
  return STRINGS.filter(s => 
    s.model.toLowerCase().includes(q) || 
    s.brand.toLowerCase().includes(q) ||
    `${s.brand} ${s.model}`.toLowerCase().includes(q)
  ).slice(0, 10);
};
