-- Seed data for local development and testing.
-- Provides sample attractions, restaurants, and hotels for Da Nang, Hoi An, and HCM.
-- All data is fictional/representative — not for production use.
-- 
-- Run: psql -U postgres -d ai_itinerary -f seed_data.sql
-- Or: mounted in docker-compose as initdb script.

-- Enable extensions (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────────────────────
-- ATTRACTIONS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO attractions (id, name, city, latitude, longitude, rating, review_count, ticket_price, category, description, source)
VALUES
-- Da Nang
('a0000001-0000-0000-0000-000000000001', 'Marble Mountains', 'Da Nang', 16.0023, 108.2619, 4.7, 8500, 40000, 'attraction', 'Cluster of five marble and limestone hills with caves and pagodas.', 'seed'),
('a0000001-0000-0000-0000-000000000002', 'Dragon Bridge', 'Da Nang', 16.0610, 108.2270, 4.6, 12000, 0, 'attraction', 'Iconic bridge in the shape of a dragon spanning the Han River.', 'seed'),
('a0000001-0000-0000-0000-000000000003', 'My Khe Beach', 'Da Nang', 16.0480, 108.2476, 4.8, 20000, 0, 'attraction', 'One of the most beautiful beaches in Vietnam.', 'seed'),
('a0000001-0000-0000-0000-000000000004', 'Ba Na Hills', 'Da Nang', 15.9974, 107.9882, 4.6, 15000, 750000, 'attraction', 'Mountain resort with Golden Bridge and French Village.', 'seed'),
('a0000001-0000-0000-0000-000000000005', 'Han Market', 'Da Nang', 16.0680, 108.2230, 4.5, 5000, 0, 'attraction', 'Traditional market in the heart of Da Nang.', 'seed'),
('a0000001-0000-0000-0000-000000000006', 'Son Tra Peninsula', 'Da Nang', 16.1130, 108.2770, 4.7, 7000, 0, 'attraction', 'Nature peninsula with panoramic ocean views and wildlife.', 'seed'),

-- Hoi An
('a0000002-0000-0000-0000-000000000001', 'Hoi An Ancient Town', 'Hoi An', 15.8801, 108.3380, 4.9, 30000, 120000, 'heritage', 'UNESCO World Heritage Site — preserved trading port town.', 'seed'),
('a0000002-0000-0000-0000-000000000002', 'Japanese Covered Bridge', 'Hoi An', 15.8771, 108.3272, 4.7, 18000, 0, 'heritage', '18th century bridge, symbol of Hoi An.', 'seed'),
('a0000002-0000-0000-0000-000000000003', 'An Bang Beach', 'Hoi An', 15.9232, 108.3738, 4.6, 9000, 0, 'attraction', 'Tranquil beach 3km from Hoi An Ancient Town.', 'seed'),
('a0000002-0000-0000-0000-000000000004', 'Tra Que Vegetable Village', 'Hoi An', 15.8990, 108.3420, 4.5, 4000, 80000, 'experience', 'Organic vegetable village with cooking classes.', 'seed'),
('a0000002-0000-0000-0000-000000000005', 'Phung Hung Old House', 'Hoi An', 15.8773, 108.3275, 4.5, 3200, 30000, 'heritage', '250-year-old merchant house blending architectural styles.', 'seed'),

-- Ho Chi Minh City
('a0000003-0000-0000-0000-000000000001', 'War Remnants Museum', 'Ho Chi Minh City', 10.7792, 106.6920, 4.7, 25000, 40000, 'museum', 'Powerful museum documenting the Vietnam War.', 'seed'),
('a0000003-0000-0000-0000-000000000002', 'Ben Thanh Market', 'Ho Chi Minh City', 10.7725, 106.6980, 4.5, 40000, 0, 'attraction', 'Historic central market with food, souvenirs and local goods.', 'seed'),
('a0000003-0000-0000-0000-000000000003', 'Reunification Palace', 'Ho Chi Minh City', 10.7769, 106.6958, 4.6, 18000, 40000, 'heritage', 'Former Presidential Palace, now a historic landmark.', 'seed'),
('a0000003-0000-0000-0000-000000000004', 'Notre-Dame Cathedral Basilica', 'Ho Chi Minh City', 10.7797, 106.6990, 4.6, 15000, 0, 'attraction', 'French colonial-era cathedral in the city center.', 'seed'),
('a0000003-0000-0000-0000-000000000005', 'Cu Chi Tunnels', 'Ho Chi Minh City', 11.1420, 106.4640, 4.7, 20000, 110000, 'heritage', 'Extensive tunnel network used during the Vietnam War.', 'seed'),
('a0000003-0000-0000-0000-000000000006', 'Jade Emperor Pagoda', 'Ho Chi Minh City', 10.7895, 106.6937, 4.6, 8000, 0, 'heritage', 'Taoist and Buddhist temple dating from 1909.', 'seed')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- RESTAURANTS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO restaurants (id, name, city, latitude, longitude, rating, review_count, avg_price, cuisine, source)
VALUES
-- Da Nang
('b0000001-0000-0000-0000-000000000001', 'Madame Lan', 'Da Nang', 16.0650, 108.2200, 4.6, 3200, 120000, 'Vietnamese', 'seed'),
('b0000001-0000-0000-0000-000000000002', 'Waterfront Restaurant', 'Da Nang', 16.0620, 108.2190, 4.5, 2800, 200000, 'International', 'seed'),
('b0000001-0000-0000-0000-000000000003', 'Com Ga A Hai', 'Da Nang', 16.0670, 108.2210, 4.7, 5000, 60000, 'Vietnamese', 'seed'),
('b0000001-0000-0000-0000-000000000004', 'Quan Bun Bo Hue O', 'Da Nang', 16.0580, 108.2140, 4.5, 1800, 45000, 'Vietnamese', 'seed'),
('b0000001-0000-0000-0000-000000000005', 'Da Nang Souvenirs & Cafe', 'Da Nang', 16.0610, 108.2170, 4.5, 1200, 80000, 'Cafe', 'seed'),

-- Hoi An
('b0000002-0000-0000-0000-000000000001', 'The Cargo Club', 'Hoi An', 15.8772, 108.3295, 4.7, 6000, 180000, 'International', 'seed'),
('b0000002-0000-0000-0000-000000000002', 'Morning Glory Restaurant', 'Hoi An', 15.8781, 108.3290, 4.8, 8000, 150000, 'Vietnamese', 'seed'),
('b0000002-0000-0000-0000-000000000003', 'White Marble Wine Bar', 'Hoi An', 15.8770, 108.3280, 4.6, 2200, 250000, 'International', 'seed'),
('b0000002-0000-0000-0000-000000000004', 'Banh Mi Phuong', 'Hoi An', 15.8775, 108.3266, 4.9, 15000, 30000, 'Vietnamese', 'seed'),
('b0000002-0000-0000-0000-000000000005', 'Mango Mango', 'Hoi An', 15.8760, 108.3300, 4.6, 3800, 160000, 'International', 'seed'),

-- Ho Chi Minh City
('b0000003-0000-0000-0000-000000000001', 'Nha Hang Ngon', 'Ho Chi Minh City', 10.7785, 106.6988, 4.5, 9000, 130000, 'Vietnamese', 'seed'),
('b0000003-0000-0000-0000-000000000002', 'The Refinery', 'Ho Chi Minh City', 10.7810, 106.6950, 4.6, 4500, 300000, 'French', 'seed'),
('b0000003-0000-0000-0000-000000000003', 'Bun Bo Nam Bo', 'Ho Chi Minh City', 10.7760, 106.6920, 4.7, 7000, 70000, 'Vietnamese', 'seed'),
('b0000003-0000-0000-0000-000000000004', 'Propaganda Bistro', 'Ho Chi Minh City', 10.7778, 106.7034, 4.6, 5200, 200000, 'Vietnamese', 'seed'),
('b0000003-0000-0000-0000-000000000005', 'Pho Thin', 'Ho Chi Minh City', 10.7820, 106.6900, 4.8, 12000, 80000, 'Vietnamese', 'seed')
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- HOTELS
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO hotels (id, name, city, latitude, longitude, rating, review_count, price_per_night, source)
VALUES
-- Da Nang
('c0000001-0000-0000-0000-000000000001', 'InterContinental Da Nang', 'Da Nang', 16.1064, 108.2741, 4.9, 5000, 3500000, 'seed'),
('c0000001-0000-0000-0000-000000000002', 'Hyatt Regency Da Nang', 'Da Nang', 16.0370, 108.2500, 4.8, 4200, 2800000, 'seed'),
('c0000001-0000-0000-0000-000000000003', 'Novotel Da Nang Premier', 'Da Nang', 16.0620, 108.2200, 4.6, 3100, 1500000, 'seed'),
('c0000001-0000-0000-0000-000000000004', 'Brilliant Hotel Da Nang', 'Da Nang', 16.0655, 108.2225, 4.5, 2200, 800000, 'seed'),

-- Hoi An
('c0000002-0000-0000-0000-000000000001', 'Four Seasons The Nam Hai', 'Hoi An', 15.9200, 108.3700, 4.9, 3800, 7000000, 'seed'),
('c0000002-0000-0000-0000-000000000002', 'Victoria Hoi An Beach Resort', 'Hoi An', 15.9100, 108.3650, 4.7, 2900, 2200000, 'seed'),
('c0000002-0000-0000-0000-000000000003', 'Anantara Hoi An Resort', 'Hoi An', 15.8800, 108.3380, 4.7, 2400, 2500000, 'seed'),
('c0000002-0000-0000-0000-000000000004', 'Pho Hoi Riverside Resort', 'Hoi An', 15.8820, 108.3400, 4.5, 1800, 600000, 'seed'),

-- Ho Chi Minh City
('c0000003-0000-0000-0000-000000000001', 'Park Hyatt Saigon', 'Ho Chi Minh City', 10.7797, 106.6998, 4.9, 6500, 4500000, 'seed'),
('c0000003-0000-0000-0000-000000000002', 'Caravelle Saigon', 'Ho Chi Minh City', 10.7789, 106.7002, 4.7, 4100, 2000000, 'seed'),
('c0000003-0000-0000-0000-000000000003', 'Liberty Central Saigon', 'Ho Chi Minh City', 10.7765, 106.6972, 4.5, 3200, 900000, 'seed'),
('c0000003-0000-0000-0000-000000000004', 'The Myst Dong Khoi', 'Ho Chi Minh City', 10.7810, 106.7030, 4.6, 2800, 1800000, 'seed')
ON CONFLICT (id) DO NOTHING;
