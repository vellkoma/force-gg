import sqlite3

conn = sqlite3.connect('LOL.db')
rows = conn.execute(
    "SELECT patch, rank_group FROM champion_stats_meta ORDER BY patch ASC"
).fetchall()
for r in rows:
    print(r)
conn.close()
