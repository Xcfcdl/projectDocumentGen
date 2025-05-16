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
  const statusPath = path.join(process.cwd(), 'public', 'uploads', task_id, 'extract_status.json');
  if (!(await fs.pathExists(statusPath))) {
    return NextResponse.json({ error: '任务不存在' }, { status: 404 });
  }
  const status = await fs.readJson(statusPath);
  return NextResponse.json(status);
} 