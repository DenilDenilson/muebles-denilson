export interface Furniture {
  slug: string;
  number: string;
  title: string;
  category: string;
  description: string;
  dimensions: { width: string; depth: string; height: string };
  model: string;
  step: string;
  sourceUrl: string;
}

export const furniture: Furniture[] = [{
  slug: 'basurero-doble',
  number: '01',
  title: 'Basurero doble',
  category: 'Cocina',
  description: 'Un lugar para cada cosa. Dos recipientes ocultos bajo el lavadero, con un frente que se inclina para acercarlos a ti.',
  dimensions: { width: '39,4', depth: '47,8', height: '66' },
  model: '/models/basurero-doble/basurero-doble.mesh.json',
  step: '/models/basurero-doble/basurero-doble.step',
  sourceUrl: 'https://simple.ripley.com.pe/basurero-compacto-para-cocina-con-tapa-315x30x12cm-plomo-y-sticky-pmp20001817796',
}];
