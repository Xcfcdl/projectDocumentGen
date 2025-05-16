import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs-extra';
import path from 'path';
import ExcelJS from 'exceljs';

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
  const tablePath = path.join(uploadDir, 'table.json');

  if (!(await fs.pathExists(tablePath))) {
    return NextResponse.json({ error: '请先生成概算表' }, { status: 404 });
  }
  const data = await fs.readJson(tablePath);
  const table = data.table;

  // 生成 Excel
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('概算表');
  if (table && table.length > 0) {
    worksheet.columns = Object.keys(table[0]).map(key => ({ header: key, key }));
    table.forEach((row: any) => worksheet.addRow(row));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${task_id}.xlsx"`
    }
  });
} 