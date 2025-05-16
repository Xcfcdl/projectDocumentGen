import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { task_id: string } }
) {
  const { task_id } = params;
  if (!task_id) {
    return NextResponse.json({ error: '缺少 task_id' }, { status: 400 });
  }
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  const resultPath = path.join(uploadDir, 'result.json');

  if (!(await fs.pathExists(resultPath))) {
    return NextResponse.json({ error: '结果文件不存在' }, { status: 404 });
  }
  const result = await fs.readFile(resultPath);
  return new Response(result, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${task_id}.json"`
    }
  });
} 