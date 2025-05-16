import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { task_id, selected_files, selected_pages } = body;

  if (!task_id || (!selected_files && !selected_pages)) {
    return NextResponse.json({ error: '请至少选择一个文件或页面' }, { status: 400 });
  }

  // 状态文件路径
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  await fs.ensureDir(uploadDir);
  const statusPath = path.join(uploadDir, 'status.json');

  // 初始化任务状态
  const status: {
    status: string;
    total: number;
    finished: number;
    results: any[];
    errors: any[];
  } = {
    status: 'processing',
    total: (selected_files?.length || 0) + (selected_pages?.length || 0),
    finished: 0,
    results: [],
    errors: []
  };
  await fs.writeJson(statusPath, status, { spaces: 2 });

  // 模拟异步处理（实际应接入队列/子进程/AI服务）
  setTimeout(async () => {
    status.status = 'done';
    status.finished = status.total;
    status.results = [{ message: '模拟处理完成' }];
    await fs.writeJson(statusPath, status, { spaces: 2 });
  }, 2000);

  return NextResponse.json({ message: 'processing started', task_id });
} 