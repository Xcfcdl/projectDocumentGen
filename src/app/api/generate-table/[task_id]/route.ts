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
    return NextResponse.json({ status: 'error', message: '缺少 task_id' }, { status: 400 });
  }
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  const tablePath = path.join(uploadDir, 'table.json');

  // 若已生成则直接返回
  if (await fs.pathExists(tablePath)) {
    const data = await fs.readJson(tablePath);
    return NextResponse.json(data);
  }

  // 模拟表格生成
  const table = [
    { "序号": 1, "项目名称": "土建工程", "金额": 123456.78 },
    { "序号": 2, "项目名称": "安装工程", "金额": 234567.89 }
  ];
  const raw = { ai: 'mock', task_id };
  const result = { status: 'ok', table, raw };
  await fs.writeJson(tablePath, result, { spaces: 2 });
  return NextResponse.json(result);
} 