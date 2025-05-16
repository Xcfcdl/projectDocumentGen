import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { fromPath } from 'pdf2pic';
import sharp from 'sharp';
import axios from 'axios';

export const dynamic = 'force-dynamic';

async function pdfToImages(pdfPath: string, outputDir: string): Promise<string[]> {
  const converter = fromPath(pdfPath, {
    density: 150,
    saveFilename: 'page',
    savePath: outputDir,
    format: 'jpg',
    width: 1200,
    height: 1600,
  });
  const totalPages = await (converter as any).info().then((info: any) => info.numpages);
  const imagePaths: string[] = [];
  for (let i = 1; i <= totalPages; i++) {
    const res = await converter(i);
    if (res.path) imagePaths.push(res.path);
  }
  return imagePaths;
}

async function compressImage(imagePath: string, maxSize = 5 * 1024 * 1024): Promise<string> {
  let quality = 90;
  let outputPath = imagePath.replace('.jpg', '_compressed.jpg');
  let buffer = await sharp(imagePath).jpeg({ quality }).toBuffer();
  while (buffer.length > maxSize && quality > 10) {
    quality -= 10;
    buffer = await sharp(imagePath).jpeg({ quality }).toBuffer();
  }
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

async function callAIAPI(imagePath: string, apiKey: string): Promise<any> {
  const imageData = await fs.readFile(imagePath);
  const base64Data = imageData.toString('base64');
  // 这里只做骨架，实际可参考 pdf_processor.py 的 payload
  const payload = {
    model: 'glm-4v-plus-0111',
    messages: [
      { role: 'system', content: '你是一个专业的工程图纸数据提取专家。' },
      { role: 'user', content: [
        { type: 'text', text: '请将这张工程图纸转换为结构化的JSON数据。' },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } }
      ]}
    ]
  };
  const response = await axios.post('https://open.bigmodel.cn/api/paas/v4/chat/completions', payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 120000
  });
  return response.data;
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) {
    return NextResponse.json({ error: '未上传PDF文件' }, { status: 400 });
  }
  const apiKey = process.env.BIGMODEL_API_KEY || '';
  if (!apiKey) {
    return NextResponse.json({ error: '未配置AI接口密钥' }, { status: 500 });
  }
  const task_id = uuidv4();
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  await fs.ensureDir(uploadDir);
  const pdfPath = path.join(uploadDir, file.name);
  const arrayBuffer = await file.arrayBuffer();
  await fs.writeFile(pdfPath, Buffer.from(arrayBuffer));

  // 异步处理（可用队列/子进程优化）
  (async () => {
    try {
      const imagePaths = await pdfToImages(pdfPath, uploadDir);
      const results = [];
      for (const img of imagePaths) {
        const compressed = await compressImage(img);
        const aiResult = await callAIAPI(compressed, apiKey);
        results.push(aiResult);
      }
      await fs.writeJson(path.join(uploadDir, 'ai_result.json'), results, { spaces: 2 });
      await fs.writeJson(path.join(uploadDir, 'extract_status.json'), { status: 'done', total: imagePaths.length, finished: imagePaths.length }, { spaces: 2 });
    } catch (e) {
      await fs.writeJson(path.join(uploadDir, 'extract_status.json'), { status: 'error', error: String(e) }, { spaces: 2 });
    }
  })();

  await fs.writeJson(path.join(uploadDir, 'extract_status.json'), { status: 'processing', total: 0, finished: 0 }, { spaces: 2 });
  return NextResponse.json({ task_id });
} 