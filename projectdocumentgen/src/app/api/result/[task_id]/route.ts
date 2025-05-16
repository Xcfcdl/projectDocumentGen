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
  const statusPath = path.join(uploadDir, 'status.json');

  if (!(await fs.pathExists(resultPath))) {
    // 若任务已完成但无结果，生成模拟结果
    if (await fs.pathExists(statusPath)) {
      const status = await fs.readJson(statusPath);
      if (status.status === 'done') {
        const mockResult = { result: { message: '模拟AI处理结果', task_id } };
        await fs.writeJson(resultPath, mockResult, { spaces: 2 });
        return NextResponse.json(mockResult);
      }
    }
    return NextResponse.json({ error: '结果文件不存在或任务失败' }, { status: 404 });
  }
  const result = await fs.readJson(resultPath);
  return NextResponse.json(result);
} 