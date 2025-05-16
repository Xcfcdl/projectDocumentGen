import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';

export async function POST(req: NextRequest) {
  const { task_id } = await req.json();
  if (!task_id) return NextResponse.json({ error: '缺少task_id' }, { status: 400 });
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', task_id);
  try {
    await fs.remove(uploadDir);
    return NextResponse.json({ status: 'ok' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
} 