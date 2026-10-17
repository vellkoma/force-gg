import sqlite3

con = sqlite3.connect('LOL.db')
tables = ['champion_stats_meta', 'champion_stats_aggregate', 'champion_item_stats']

with open('champ_stats_dump.sql', 'w', encoding='utf-8') as f:
    f.write('PRAGMA journal_mode=WAL;\n')
    f.write('BEGIN TRANSACTION;\n\n')
    for table in tables:
        f.write(f'DELETE FROM {table};\n')
    f.write('\n')
    for line in con.iterdump():
        for table in tables:
            if f'INSERT INTO "{table}"' in line or f"INSERT INTO '{table}'" in line:
                f.write(line + '\n')
                break
    f.write('\nCOMMIT;\n')

con.close()
print('完了')
