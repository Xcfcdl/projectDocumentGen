import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fromPath } from 'pdf2pic';
import { PDFDocument } from 'pdf-lib';

export const dynamic = 'force-dynamic'; // 允许 Edge/Node 动态 API

async function getPdfPageCount(pdfPath: string): Promise<number> {
  const data = await fs.readFile(pdfPath);
  const pdfDoc = await PDFDocument.load(data);
  return pdfDoc.getPageCount();
}

async function pdfToImages(pdfPath: string, outputDir: string): Promise<string[]> {
  const pageCount = await getPdfPageCount(pdfPath);
  const converter = fromPath(pdfPath, {
    density: 150,
    saveFilename: 'page',
    savePath: outputDir,
    format: 'jpg',
    width: 1200,
    height: 1600,
  });
  const imagePaths: string[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const res = await converter(i);
    if (res.path) imagePaths.push(res.path);
  }
  return imagePaths;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const files = formData.getAll('files');
  if (!files || files.length === 0) {
    return NextResponse.json({ error: '未选择文件' }, { status: 400 });
  }
  const task_id = uuidv4();
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  await fs.ensureDir(uploadDir);
  let allImages: string[] = [];
  for (const file of files) {
    // @ts-ignore
    const f = file as File;
    const arrayBuffer = await f.arrayBuffer();
    const ext = f.name.split('.').pop()?.toLowerCase();
    const filePath = path.join(uploadDir, f.name);
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
    if (ext === 'pdf') {
      // PDF转图片
      const images = await pdfToImages(filePath, uploadDir);
      allImages.push(...images.map(img => path.basename(img)));
    } else if (['jpg','jpeg','png','bmp','gif','webp'].includes(ext || '')) {
      allImages.push(f.name);
    }
  }
  return NextResponse.json({ task_id, images: allImages });
} 