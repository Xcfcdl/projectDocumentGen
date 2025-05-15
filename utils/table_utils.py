def extract_table_rows(table_data):
    """从AI返回的结构化数据中提取所有 subprojects[].items 合并为表格数组"""
    table_rows = []
    if isinstance(table_data, dict) and 'subprojects' in table_data:
        for sub in table_data['subprojects']:
            major = sub.get('major', '')
            for item in sub.get('items', []):
                row = dict(item)
                row['major'] = major
                table_rows.append(row)
    return table_rows 