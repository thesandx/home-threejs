/**
 * The material library.
 *
 * One instance owns every material and texture in the scene, so colours and
 * roughness stay consistent and disposal is a single call. Colours are taken
 * from the front elevation: cream render, warm teak cladding, dark window
 * frames, glass railings, and polished stone floors.
 *
 * Materials are physically based (`MeshStandardMaterial`): roughness and
 * metalness do the work, tone mapping and the environment map do the rest.
 */

import { type CanvasTexture, Color, DoubleSide, MeshStandardMaterial, type Texture } from 'three';

import {
  grassTexture,
  marbleTexture,
  pavingTexture,
  slatTexture,
  stuccoTexture,
  tileTexture,
  woodTexture,
} from './textures';

export class MaterialLibrary {
  private readonly textures: Texture[] = [];
  private readonly materials: MeshStandardMaterial[] = [];

  // Exterior shell
  readonly stucco: MeshStandardMaterial;
  readonly stuccoWhite: MeshStandardMaterial;
  readonly claddingWood: MeshStandardMaterial;
  readonly parapet: MeshStandardMaterial;

  // Interior surfaces
  readonly interiorWall: MeshStandardMaterial;
  readonly ceiling: MeshStandardMaterial;
  readonly soffitWood: MeshStandardMaterial;
  readonly marbleFloor: MeshStandardMaterial;
  readonly tileFloor: MeshStandardMaterial;
  readonly bathroomFloor: MeshStandardMaterial;

  // Openings
  readonly glass: MeshStandardMaterial;
  readonly glassRail: MeshStandardMaterial;
  readonly frameDark: MeshStandardMaterial;
  readonly doorWood: MeshStandardMaterial;

  // Site
  readonly grass: MeshStandardMaterial;
  readonly driveway: MeshStandardMaterial;
  readonly street: MeshStandardMaterial;
  readonly boundaryWall: MeshStandardMaterial;

  // Fittings and furniture
  readonly metalDark: MeshStandardMaterial;
  readonly steel: MeshStandardMaterial;
  readonly fabricLight: MeshStandardMaterial;
  readonly fabricWarm: MeshStandardMaterial;
  readonly fabricGreen: MeshStandardMaterial;
  readonly woodFurniture: MeshStandardMaterial;
  readonly woodDark: MeshStandardMaterial;
  readonly cushion: MeshStandardMaterial;
  readonly plantLeaf: MeshStandardMaterial;
  readonly plantTrunk: MeshStandardMaterial;
  readonly porcelain: MeshStandardMaterial;
  readonly blackScreen: MeshStandardMaterial;
  readonly brass: MeshStandardMaterial;

  // Facade set, sampled from the reference photographs of the built house.
  readonly facadeCream: MeshStandardMaterial; // main field wall
  readonly facadeTan: MeshStandardMaterial; // darker accent panel
  readonly facadeWhite: MeshStandardMaterial; // projecting frames and bands
  readonly windowSurround: MeshStandardMaterial; // dark taupe box reveals
  readonly slatWood: MeshStandardMaterial; // terracotta hood / louvre slats
  readonly balconyCeiling: MeshStandardMaterial; // dark stained soffit
  readonly gateWood: MeshStandardMaterial; // dark brown gate leaves
  readonly concreteApron: MeshStandardMaterial; // grey cast driveway
  readonly reveal: MeshStandardMaterial; // shadow line inside a groove
  readonly teak: MeshStandardMaterial; // rich cladding / louvre / soffit timber
  readonly darkGlazing: MeshStandardMaterial; // near-black stair-tower glass
  readonly charcoal: MeshStandardMaterial; // window frames, gate, fascia
  readonly downlight: MeshStandardMaterial; // lit recessed fitting
  readonly curtain: MeshStandardMaterial; // sheer white curtain behind glass
  readonly pavingTile: MeshStandardMaterial; // beige large-format forecourt

  constructor() {
    const track = <T extends Texture>(t: T): T => {
      this.textures.push(t);
      return t;
    };
    const mat = (m: MeshStandardMaterial): MeshStandardMaterial => {
      this.materials.push(m);
      return m;
    };

    const stuccoMap = track(stuccoTexture('#ddd6c6', 6));
    const whiteMap = track(stuccoTexture('#f1eee6', 6));
    const woodMapV = track(woodTexture(1));
    const woodSoffit = track(woodTexture(3, false));
    const marbleMap = track(marbleTexture(4));
    const tileMap = track(tileTexture('#c9c3b6', '#a59f92', 5));
    const bathMap = track(tileTexture('#dbe4e6', '#b3bcbe', 6));
    const grassMap = track(grassTexture(24));
    const driveMap = track(pavingTexture('#b8b2a6', 8));
    const streetMap = track(pavingTexture('#4c4c50', 10));
    const furnitureWood = track(woodTexture(2));

    const withMap = (m: MeshStandardMaterial, map: CanvasTexture): MeshStandardMaterial => {
      m.map = map;
      return m;
    };

    this.stucco = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), stuccoMap),
    );
    this.stuccoWhite = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), whiteMap),
    );
    this.claddingWood = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }), woodMapV),
    );
    this.parapet = mat(new MeshStandardMaterial({ color: 0xcfc9bd, roughness: 0.9 }));

    this.interiorWall = mat(new MeshStandardMaterial({ color: 0xe3ddd0, roughness: 0.95 }));
    this.ceiling = mat(new MeshStandardMaterial({ color: 0xebe7de, roughness: 1 }));
    this.soffitWood = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), woodSoffit),
    );
    this.marbleFloor = mat(
      withMap(
        new MeshStandardMaterial({ color: 0xffffff, roughness: 0.18, metalness: 0.04 }),
        marbleMap,
      ),
    );
    this.tileFloor = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }), tileMap),
    );
    this.bathroomFloor = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }), bathMap),
    );

    this.glass = mat(
      new MeshStandardMaterial({
        color: 0xbcd2d8,
        roughness: 0.05,
        metalness: 0,
        transparent: true,
        opacity: 0.28,
        side: DoubleSide,
      }),
    );
    this.glassRail = mat(
      new MeshStandardMaterial({
        color: 0xd7e6ea,
        roughness: 0.04,
        metalness: 0,
        transparent: true,
        opacity: 0.22,
        side: DoubleSide,
      }),
    );
    this.frameDark = mat(
      new MeshStandardMaterial({ color: 0x2a2a2d, roughness: 0.4, metalness: 0.5 }),
    );
    this.doorWood = mat(
      withMap(
        new MeshStandardMaterial({ color: 0x6f4a2c, roughness: 0.5 }),
        track(woodTexture(1.5)),
      ),
    );

    this.grass = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 1 }), grassMap),
    );
    this.driveway = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), driveMap),
    );
    this.street = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), streetMap),
    );
    this.boundaryWall = mat(new MeshStandardMaterial({ color: 0xe9e4d8, roughness: 0.9 }));

    this.metalDark = mat(
      new MeshStandardMaterial({ color: 0x26282b, roughness: 0.45, metalness: 0.85 }),
    );
    this.steel = mat(new MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.9 }));
    this.fabricLight = mat(new MeshStandardMaterial({ color: 0xd9d2c4, roughness: 0.95 }));
    this.fabricWarm = mat(new MeshStandardMaterial({ color: 0xb8956a, roughness: 0.95 }));
    this.fabricGreen = mat(new MeshStandardMaterial({ color: 0x3f5f4a, roughness: 0.95 }));
    this.woodFurniture = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), furnitureWood),
    );
    this.woodDark = mat(new MeshStandardMaterial({ color: 0x3c2a1c, roughness: 0.5 }));
    this.cushion = mat(new MeshStandardMaterial({ color: 0xe7e1d6, roughness: 1 }));
    this.plantLeaf = mat(
      new MeshStandardMaterial({ color: 0x3c6b3a, roughness: 0.85, side: DoubleSide }),
    );
    this.plantTrunk = mat(new MeshStandardMaterial({ color: 0x5a4632, roughness: 0.9 }));
    this.porcelain = mat(new MeshStandardMaterial({ color: 0xf7f8fa, roughness: 0.15 }));
    this.blackScreen = mat(
      new MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2, metalness: 0.3 }),
    );
    this.brass = mat(
      new MeshStandardMaterial({ color: 0xb08d57, roughness: 0.35, metalness: 0.9 }),
    );

    // --- Facade set -----------------------------------------------------
    // Sampled from the reference photographs: a warm cream field, a darker tan
    // accent panel, near-white projecting frames, dark taupe window reveals,
    // and terracotta slatted timber for the hoods and louvres.
    // Deeper than they look on screen: under a strong sun with ACES tone
    // mapping a light render reads almost white, so the base tones are pitched
    // down to keep the cream/tan separation the photographs show.
    const creamMap = track(stuccoTexture('#cdbf9f', 5));
    const tanMap = track(stuccoTexture('#9d8a6d', 5));
    const frameMap = track(stuccoTexture('#e2dbc9', 4));
    const slatMap = track(slatTexture(1));
    // The soffit is stained a deep chocolate, so it takes the plain wood grain
    // rather than the terracotta slat map, which reads far too red at depth.
    const soffitMap = track(woodTexture(3, false));
    const apronMap = track(pavingTexture('#b4b1a9', 6));

    this.facadeCream = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.94 }), creamMap),
    );
    this.facadeTan = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.94 }), tanMap),
    );
    this.facadeWhite = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 }), frameMap),
    );
    this.windowSurround = mat(new MeshStandardMaterial({ color: 0x6d6055, roughness: 0.8 }));
    this.slatWood = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.62 }), slatMap),
    );
    this.balconyCeiling = mat(
      withMap(new MeshStandardMaterial({ color: 0x51392a, roughness: 0.72 }), soffitMap),
    );
    this.gateWood = mat(
      new MeshStandardMaterial({ color: 0x402c20, roughness: 0.55, metalness: 0.25 }),
    );
    this.concreteApron = mat(
      withMap(new MeshStandardMaterial({ color: 0xffffff, roughness: 0.95 }), apronMap),
    );
    this.reveal = mat(new MeshStandardMaterial({ color: 0x8d8477, roughness: 1 }));

    // The elevation's timber: a rich reddish teak used for the stair-tower
    // cladding, the balcony louvres and the plank soffits.
    // Toned well down from the raw slat map, which is far too saturated a
    // terracotta on its own — the reference timber is a warm mid brown.
    const teakMap = track(slatTexture(1, 6));
    this.teak = mat(
      withMap(new MeshStandardMaterial({ color: 0x7a5236, roughness: 0.55 }), teakMap),
    );
    this.darkGlazing = mat(
      new MeshStandardMaterial({ color: 0x191d23, roughness: 0.1, metalness: 0.55 }),
    );
    this.charcoal = mat(
      new MeshStandardMaterial({ color: 0x2b2e33, roughness: 0.45, metalness: 0.35 }),
    );
    // Emissive so the recessed fittings actually read as lit in the render.
    this.downlight = mat(
      new MeshStandardMaterial({
        color: 0xffe6bd,
        emissive: 0xffc879,
        emissiveIntensity: 2.4,
        roughness: 0.3,
      }),
    );
    this.curtain = mat(
      new MeshStandardMaterial({ color: 0xf4f1ea, roughness: 1, emissive: 0x2a2418 }),
    );
    this.pavingTile = mat(
      withMap(
        new MeshStandardMaterial({ color: 0xffffff, roughness: 0.82 }),
        track(tileTexture('#ddd2bd', '#bdb29d', 7)),
      ),
    );
  }

  /** A tinted one-off wall-paint variant, tracked for disposal. */
  paint(hex: number): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color: new Color(hex), roughness: 0.95 });
    this.materials.push(m);
    return m;
  }

  dispose(): void {
    for (const t of this.textures) t.dispose();
    for (const m of this.materials) m.dispose();
    this.textures.length = 0;
    this.materials.length = 0;
  }
}
