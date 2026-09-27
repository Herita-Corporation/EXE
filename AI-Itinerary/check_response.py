import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('test_new_response.json', encoding='utf-8') as f:
    data = json.load(f)

days = data.get('days', [])
print(f'SUCCESS! Total days: {len(days)}')
print(f'Total cost: {data.get("total_cost", 0):,.0f} VND')

for day_idx, day in enumerate(days):
    acts = day.get('activities', [])
    flex = [a for a in acts if a.get('slot_type') == 'flexible']
    print(f'\n--- Day {day_idx+1} ({day["date"]}) - {len(flex)} flexible slots ---')
    for a in flex:
        recs = a.get('recommendations', [])
        print(f'  [{a["type"]}] {a.get("name","?")} -> {len(recs)} recommendations')
        for r in recs:
            place_name = r['place']['name']
            print(f'    priority {r["priority"]}: {place_name}')
            print(f'      reason: {r["reason"]}')
