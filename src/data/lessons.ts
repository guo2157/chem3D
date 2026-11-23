import type { TeachingStep } from '../types/crystal';

export const bccLesson: TeachingStep[] = [
  { id: 'overview', title: '认识晶胞', narration: '[[晶胞|action:position]]是描述晶体结构的基本单元。先旋转模型，观察八个顶点与立方体中心。', camera: 'textbook', focus: 'all' },
  { id: 'vertices', title: '顶点原子', narration: '每个[[顶点原子|site:Fe1]]同时被 8 个相邻晶胞共享，因此对当前晶胞的贡献是 1/8。', camera: 'textbook', focus: 'vertex', display: { coloring: 'position' }, calculation: '8 × 1/8 = 1' },
  { id: 'center', title: '体心原子', narration: '[[体心原子|site:Fe2]]位于分数坐标 (1/2, 1/2, 1/2)，完全属于当前晶胞。', camera: 'textbook', focus: 'interior', calculation: '1 × 1 = 1' },
  { id: 'diagonal', title: '体对角线', narration: '顶点—体心—顶点三点共线。[[体对角线|action:body-diagonal]]长度为 √3a。', camera: '111', focus: 'all', display: { showBodyDiagonal: true }, calculation: 'd = √3a' },
  { id: 'contact', title: '原子接触', narration: '在堆积模型中，原子沿[[体对角线|action:body-diagonal]]相切，因此 4r = √3a。', camera: '111', display: { displayStyle: 'packing', showBodyDiagonal: true }, calculation: 'r = √3a / 4' },
  { id: 'count', title: '粒子计数', narration: '把边界原子[[截在晶胞内|action:truncate]]，可以直接看到顶点只保留八分之一。', camera: 'textbook', display: { coloring: 'position', truncate: true }, calculation: '8 × 1/8 + 1 × 1 = 2' },
  { id: 'coordination', title: '配位关系', narration: '每个[[体心原子|site:Fe2]]最近邻为周围 8 个顶点原子，[[配位数|action:coord]]是 8。', camera: 'textbook', focus: 'interior', display: { extension: 2 }, calculation: '配位数 = 8' },
  { id: 'summary', title: '结构小结', narration: '体心立方晶胞含 2 个原子，配位数为 8，空间利用率约为 68%。', camera: 'textbook', focus: 'all', calculation: 'N = 2 · CN = 8 · η ≈ 68%' },
];
