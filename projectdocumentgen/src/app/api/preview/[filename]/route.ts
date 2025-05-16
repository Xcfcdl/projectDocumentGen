import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params;
  const task_id = req.nextUrl.searchParams.get('task_id');
  if (!filename || !task_id) {
    return NextResponse.json({ error: '缺少 filename 或 task_id' }, { status: 400 });
  }
  const filePath = path.join(process.cwd(), 'public', 'uploads', task_id, filename);
  if (!(await fs.pathExists(filePath))) {
    return new Response('File not found', { status: 404 });
  }
  const ext = path.extname(filename).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  if (ext === '.png') contentType = 'image/png';
  if (ext === '.gif') contentType = 'image/gif';
  const file = await fs.readFile(filePath);
  return new Response(file, {
    headers: {
      'Content-Type': contentType
    }
  });
} 