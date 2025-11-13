-- ============================================================================
-- GT-R Marketplace Seed Data Script
-- Run this script in Supabase SQL Editor AFTER setup_complete.sql
-- This creates realistic sample data for testing and development
-- ============================================================================

-- ============================================================================
-- USER UUIDs (Replace these with your actual user UUIDs)
-- ============================================================================
-- User 1: 186dc8cb-c6dd-4e79-97be-eb477d100352 (test@user4.com)
-- User 2: 2e54e24f-85ab-47ef-96ff-6b69b148d2c4 (test@user2.com)
-- User 3: 33c95074-90c4-4891-809c-ae1e32691aa5 (test@user3.com)

-- ============================================================================
-- STEP 1: UPDATE USER PROFILES
-- ============================================================================

-- Update profiles for existing users
INSERT INTO profiles (id, username, full_name, email, phone_number, phone_verified, bio, avatar_url, location)
VALUES
  (
    '186dc8cb-c6dd-4e79-97be-eb477d100352',
    'gtr_enthusiast',
    'Alex Johnson',
    'test@user4.com',
    '+1656434543',
    true,
    'GT-R owner since 2018. Love tracking my R35 and sharing mods with the community.',
    'https://picsum.photos/200/200?random=1',
    'Los Angeles, CA'
  )
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone_number = EXCLUDED.phone_number,
  phone_verified = EXCLUDED.phone_verified,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  location = EXCLUDED.location;

INSERT INTO profiles (id, username, full_name, email, phone_number, phone_verified, bio, avatar_url, location)
VALUES
  (
    '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
    'r34_legend',
    'Mike Chen',
    'test@user2.com',
    '+1343234321',
    true,
    'R34 Skyline GT-R collector. Passionate about JDM culture and restoration.',
    'https://picsum.photos/200/200?random=2',
    'Miami, FL'
  )
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone_number = EXCLUDED.phone_number,
  phone_verified = EXCLUDED.phone_verified,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  location = EXCLUDED.location;

INSERT INTO profiles (id, username, full_name, email, phone_number, phone_verified, bio, avatar_url, location)
VALUES
  (
    '33c95074-90c4-4891-809c-ae1e32691aa5',
    'nismo_fan',
    'Sarah Martinez',
    'test@user3.com',
    '+11232597564',
    false,
    'Nismo GT-R owner. Track days and car meets are my thing!',
    'https://picsum.photos/200/200?random=3',
    'Austin, TX'
  )
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  phone_number = EXCLUDED.phone_number,
  phone_verified = EXCLUDED.phone_verified,
  bio = EXCLUDED.bio,
  avatar_url = EXCLUDED.avatar_url,
  location = EXCLUDED.location;

-- ============================================================================
-- STEP 2: CREATE MODEL SPECS (Reference Data)
-- ============================================================================

INSERT INTO model_specs (model, year, engine, displacement, horsepower, torque, transmission, drivetrain, weight, length, width, height, wheelbase, fuel_capacity, mpg_city, mpg_highway, acceleration_0_60, top_speed)
VALUES
  ('Nissan GT-R R35', 2024, 'VR38DETT V6', '3.8L', 565, 467, '6-Speed Dual Clutch', 'AWD', 1740, 471.0, 189.5, 137.8, 109.4, 19.5, 16, 23, 2.9, 196),
  ('Nissan GT-R R35', 2020, 'VR38DETT V6', '3.8L', 565, 467, '6-Speed Dual Clutch', 'AWD', 1740, 471.0, 189.5, 137.8, 109.4, 19.5, 16, 23, 2.9, 196),
  ('Nissan GT-R R35', 2017, 'VR38DETT V6', '3.8L', 565, 467, '6-Speed Dual Clutch', 'AWD', 1740, 471.0, 189.5, 137.8, 109.4, 19.5, 16, 23, 2.9, 196),
  ('Nissan GT-R R34', 2002, 'RB26DETT I6', '2.6L', 276, 289, '6-Speed Manual', 'AWD', 1560, 460.0, 178.5, 136.0, 266.7, 19.5, 15, 22, 4.0, 180),
  ('Nissan GT-R R33', 1998, 'RB26DETT I6', '2.6L', 276, 289, '6-Speed Manual', 'AWD', 1530, 467.0, 178.0, 136.0, 272.0, 19.5, 15, 22, 4.1, 180),
  ('Nissan GT-R R32', 1994, 'RB26DETT I6', '2.6L', 276, 289, '5-Speed Manual', 'AWD', 1430, 454.0, 175.5, 134.0, 261.4, 19.5, 15, 22, 4.2, 180),
  ('Nissan GT-R Nismo', 2024, 'VR38DETT V6', '3.8L', 600, 481, '6-Speed Dual Clutch', 'AWD', 1720, 471.0, 189.5, 137.8, 109.4, 19.5, 16, 23, 2.7, 205)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 3: CREATE CAR LISTINGS
-- ============================================================================

-- Listing 1: R35 Premium Edition
INSERT INTO listings (user_id, title, model, year, price, mileage, description, condition, city, state, zip_code, location, vin, color, transmission, status)
VALUES
  (
    '186dc8cb-c6dd-4e79-97be-eb477d100352',
    '2020 Nissan GT-R Premium - Immaculate Condition',
    'Nissan GT-R R35',
    2020,
    95000.00,
    12000,
    'Garage kept, never tracked. Full service history. Premium package with all options. Perfect for collector or daily driver.',
    'Excellent',
    'Los Angeles',
    'CA',
    '90001',
    'Los Angeles, CA',
    'JN1AZ4EH0LM123456',
    'Pearl White',
    '6-Speed Dual Clutch',
    'active'
  );

-- Listing 2: R34 Skyline
INSERT INTO listings (user_id, title, model, year, price, mileage, description, condition, city, state, zip_code, location, vin, color, transmission, status)
VALUES
  (
    '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
    '2002 Nissan Skyline GT-R R34 - Rare Bayside Blue',
    'Nissan GT-R R34',
    2002,
    185000.00,
    45000,
    'Authentic JDM import. Bayside Blue paint. Original RB26 engine. All documentation included. One of the cleanest R34s in the US.',
    'Excellent',
    'Miami',
    'FL',
    '33101',
    'Miami, FL',
    'BNR34-123456',
    'Bayside Blue',
    '6-Speed Manual',
    'active'
  );

-- Listing 3: R35 Track Edition
INSERT INTO listings (user_id, title, model, year, price, mileage, description, condition, city, state, zip_code, location, vin, color, transmission, status)
VALUES
  (
    '33c95074-90c4-4891-809c-ae1e32691aa5',
    '2017 GT-R Track Edition - Track Ready',
    'Nissan GT-R R35',
    2017,
    85000.00,
    28000,
    'Track Edition with carbon fiber package. Professionally maintained. Recent brake and tire service. Ready for track days.',
    'Very Good',
    'Austin',
    'TX',
    '78701',
    'Austin, TX',
    'JN1AZ4EH0HM789012',
    'Jet Black',
    '6-Speed Dual Clutch',
    'active'
  );

-- Listing 4: R35 Nismo
INSERT INTO listings (user_id, title, model, year, price, mileage, description, condition, city, state, zip_code, location, vin, color, transmission, status)
VALUES
  (
    '186dc8cb-c6dd-4e79-97be-eb477d100352',
    '2024 GT-R Nismo - Brand New',
    'Nissan GT-R Nismo',
    2024,
    215000.00,
    500,
    'Brand new Nismo edition. Only 500 miles. All factory options. Still under warranty. Must see!',
    'Like New',
    'Los Angeles',
    'CA',
    '90001',
    'Los Angeles, CA',
    'JN1AZ4EH0NM345678',
    'Super Silver',
    '6-Speed Dual Clutch',
    'active'
  );

-- Listing 5: R33 Skyline
INSERT INTO listings (user_id, title, model, year, price, mileage, description, condition, city, state, zip_code, location, vin, color, transmission, status)
VALUES
  (
    '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
    '1998 Skyline GT-R R33 - Clean Import',
    'Nissan GT-R R33',
    1998,
    75000.00,
    62000,
    'Legal US import. Clean title. Original RB26 engine. Recent timing belt service. Great daily driver or weekend warrior.',
    'Good',
    'Miami',
    'FL',
    '33101',
    'Miami, FL',
    'BNR33-789012',
    'Champion Blue',
    '6-Speed Manual',
    'active'
  );

-- Listing 6: R35 Base Model
INSERT INTO listings (user_id, title, model, year, price, mileage, description, condition, city, state, zip_code, location, vin, color, transmission, status)
VALUES
  (
    '33c95074-90c4-4891-809c-ae1e32691aa5',
    '2019 GT-R Base - Great Price',
    'Nissan GT-R R35',
    2019,
    88000.00,
    35000,
    'Well maintained base model. All service records. No accidents. Clean CarFax. Great entry into GT-R ownership.',
    'Very Good',
    'Austin',
    'TX',
    '78701',
    'Austin, TX',
    'JN1AZ4EH0KM456789',
    'Deep Blue Pearl',
    '6-Speed Dual Clutch',
    'active'
  );

-- Listing 7: R32 Skyline
INSERT INTO listings (user_id, title, model, year, price, mileage, description, condition, city, state, zip_code, location, vin, color, transmission, status)
VALUES
  (
    '186dc8cb-c6dd-4e79-97be-eb477d100352',
    '1994 Skyline GT-R R32 - Classic JDM',
    'Nissan GT-R R32',
    1994,
    65000.00,
    78000,
    'Classic R32 in excellent condition. Original motor. Some tasteful mods. Perfect for collector or enthusiast.',
    'Good',
    'Los Angeles',
    'CA',
    '90001',
    'Los Angeles, CA',
    'BNR32-345678',
    'Gunmetal Gray',
    '5-Speed Manual',
    'active'
  );

-- Listing 8: R35 Premium (Sold Example)
INSERT INTO listings (user_id, title, model, year, price, mileage, description, condition, city, state, zip_code, location, vin, color, transmission, status, sold_at)
VALUES
  (
    '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
    '2021 GT-R Premium - SOLD',
    'Nissan GT-R R35',
    2021,
    105000.00,
    15000,
    'Recently sold listing for reference.',
    'Excellent',
    'Miami',
    'FL',
    '33101',
    'Miami, FL',
    'JN1AZ4EH0LM901234',
    'Red',
    '6-Speed Dual Clutch',
    'sold',
    NOW() - INTERVAL '30 days'
  );

-- ============================================================================
-- STEP 4: CREATE LISTING IMAGES
-- ============================================================================

-- Get listing IDs (we'll use a subquery approach)
DO $$
DECLARE
  listing1_id UUID;
  listing2_id UUID;
  listing3_id UUID;
  listing4_id UUID;
  listing5_id UUID;
  listing6_id UUID;
  listing7_id UUID;
BEGIN
  -- Get listing IDs
  SELECT id INTO listing1_id FROM listings WHERE title = '2020 Nissan GT-R Premium - Immaculate Condition' LIMIT 1;
  SELECT id INTO listing2_id FROM listings WHERE title = '2002 Nissan Skyline GT-R R34 - Rare Bayside Blue' LIMIT 1;
  SELECT id INTO listing3_id FROM listings WHERE title = '2017 GT-R Track Edition - Track Ready' LIMIT 1;
  SELECT id INTO listing4_id FROM listings WHERE title = '2024 GT-R Nismo - Brand New' LIMIT 1;
  SELECT id INTO listing5_id FROM listings WHERE title = '1998 Skyline GT-R R33 - Clean Import' LIMIT 1;
  SELECT id INTO listing6_id FROM listings WHERE title = '2019 GT-R Base - Great Price' LIMIT 1;
  SELECT id INTO listing7_id FROM listings WHERE title = '1994 Skyline GT-R R32 - Classic JDM' LIMIT 1;

  -- Listing 1 Images
  INSERT INTO listing_images (listing_id, image_url, storage_path, is_primary, display_order)
  VALUES
    (listing1_id, 'https://picsum.photos/1200/800?random=101', 'listing-images/listing1-1.jpg', true, 0),
    (listing1_id, 'https://picsum.photos/1200/800?random=102', 'listing-images/listing1-2.jpg', false, 1),
    (listing1_id, 'https://picsum.photos/1200/800?random=103', 'listing-images/listing1-3.jpg', false, 2),
    (listing1_id, 'https://picsum.photos/1200/800?random=104', 'listing-images/listing1-4.jpg', false, 3);

  -- Listing 2 Images
  INSERT INTO listing_images (listing_id, image_url, storage_path, is_primary, display_order)
  VALUES
    (listing2_id, 'https://picsum.photos/1200/800?random=201', 'listing-images/listing2-1.jpg', true, 0),
    (listing2_id, 'https://picsum.photos/1200/800?random=202', 'listing-images/listing2-2.jpg', false, 1),
    (listing2_id, 'https://picsum.photos/1200/800?random=203', 'listing-images/listing2-3.jpg', false, 2);

  -- Listing 3 Images
  INSERT INTO listing_images (listing_id, image_url, storage_path, is_primary, display_order)
  VALUES
    (listing3_id, 'https://picsum.photos/1200/800?random=301', 'listing-images/listing3-1.jpg', true, 0),
    (listing3_id, 'https://picsum.photos/1200/800?random=302', 'listing-images/listing3-2.jpg', false, 1),
    (listing3_id, 'https://picsum.photos/1200/800?random=303', 'listing-images/listing3-3.jpg', false, 2),
    (listing3_id, 'https://picsum.photos/1200/800?random=304', 'listing-images/listing3-4.jpg', false, 3),
    (listing3_id, 'https://picsum.photos/1200/800?random=305', 'listing-images/listing3-5.jpg', false, 4);

  -- Listing 4 Images
  INSERT INTO listing_images (listing_id, image_url, storage_path, is_primary, display_order)
  VALUES
    (listing4_id, 'https://picsum.photos/1200/800?random=401', 'listing-images/listing4-1.jpg', true, 0),
    (listing4_id, 'https://picsum.photos/1200/800?random=402', 'listing-images/listing4-2.jpg', false, 1);

  -- Listing 5 Images
  INSERT INTO listing_images (listing_id, image_url, storage_path, is_primary, display_order)
  VALUES
    (listing5_id, 'https://picsum.photos/1200/800?random=501', 'listing-images/listing5-1.jpg', true, 0),
    (listing5_id, 'https://picsum.photos/1200/800?random=502', 'listing-images/listing5-2.jpg', false, 1),
    (listing5_id, 'https://picsum.photos/1200/800?random=503', 'listing-images/listing5-3.jpg', false, 2);

  -- Listing 6 Images
  INSERT INTO listing_images (listing_id, image_url, storage_path, is_primary, display_order)
  VALUES
    (listing6_id, 'https://picsum.photos/1200/800?random=601', 'listing-images/listing6-1.jpg', true, 0),
    (listing6_id, 'https://picsum.photos/1200/800?random=602', 'listing-images/listing6-2.jpg', false, 1),
    (listing6_id, 'https://picsum.photos/1200/800?random=603', 'listing-images/listing6-3.jpg', false, 2);

  -- Listing 7 Images
  INSERT INTO listing_images (listing_id, image_url, storage_path, is_primary, display_order)
  VALUES
    (listing7_id, 'https://picsum.photos/1200/800?random=701', 'listing-images/listing7-1.jpg', true, 0),
    (listing7_id, 'https://picsum.photos/1200/800?random=702', 'listing-images/listing7-2.jpg', false, 1);
END $$;

-- ============================================================================
-- STEP 5: CREATE USER GARAGES
-- ============================================================================

INSERT INTO user_garage (user_id, model, year, nickname, description, cover_image_url, mods)
VALUES
  (
    '186dc8cb-c6dd-4e79-97be-eb477d100352',
    'Nissan GT-R R35',
    2020,
    'The Beast',
    'My daily driver and track car. Fully built with E85 tune.',
    'https://picsum.photos/800/600?random=801',
    ARRAY['Cobb Accessport', 'AMS Alpha 10 Turbo Kit', 'E85 Fuel System', 'KW V3 Coilovers', 'Apex Wheels']
  ),
  (
    '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
    'Nissan GT-R R34',
    2002,
    'Midnight',
    'My pride and joy. Original Bayside Blue, tastefully modded.',
    'https://picsum.photos/800/600?random=802',
    ARRAY['HKS Exhaust', 'Nismo Wheels', 'Bilstein Suspension', 'HKS Intercooler']
  ),
  (
    '33c95074-90c4-4891-809c-ae1e32691aa5',
    'Nissan GT-R Nismo',
    2024,
    'Nismo',
    'Brand new Nismo edition. Stock for now, planning mods soon.',
    'https://picsum.photos/800/600?random=803',
    ARRAY[]::TEXT[]
  ),
  (
    '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
    'Nissan GT-R R33',
    1998,
    'Classic',
    'Restoration project. Almost done!',
    'https://picsum.photos/800/600?random=804',
    ARRAY['OEM Restoration', 'New Paint', 'Engine Rebuild']
  );

-- ============================================================================
-- STEP 6: CREATE FORUM POSTS
-- ============================================================================

DO $$
DECLARE
  post1_id UUID;
  post2_id UUID;
  post3_id UUID;
  post4_id UUID;
BEGIN
  -- Post 1
  INSERT INTO forum_posts (user_id, model, title, content, image_urls)
  VALUES
    (
      '186dc8cb-c6dd-4e79-97be-eb477d100352',
      'Nissan GT-R R35',
      'Best exhaust system for R35?',
      'Looking for recommendations on exhaust systems. Want something that sounds great but not too loud for daily driving. Considering Armytrix or Akrapovic. What do you guys think?',
      ARRAY['https://picsum.photos/800/600?random=901', 'https://picsum.photos/800/600?random=902']
    )
  RETURNING id INTO post1_id;

  -- Post 2
  INSERT INTO forum_posts (user_id, model, title, content, image_urls)
  VALUES
    (
      '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
      'Nissan GT-R R34',
      'R34 restoration complete!',
      'Finally finished my R34 restoration project. Took 2 years but worth every minute. Check out the before and after photos!',
      ARRAY['https://picsum.photos/800/600?random=903', 'https://picsum.photos/800/600?random=904', 'https://picsum.photos/800/600?random=905']
    )
  RETURNING id INTO post2_id;

  -- Post 3
  INSERT INTO forum_posts (user_id, model, title, content, image_urls)
  VALUES
    (
      '33c95074-90c4-4891-809c-ae1e32691aa5',
      'Nissan GT-R Nismo',
      'First track day with the Nismo',
      'Took my new Nismo to the track yesterday. Absolutely incredible! The handling is on another level. Here are some action shots.',
      ARRAY['https://picsum.photos/800/600?random=906']
    )
  RETURNING id INTO post3_id;

  -- Post 4
  INSERT INTO forum_posts (user_id, model, title, content, image_urls)
  VALUES
    (
      '186dc8cb-c6dd-4e79-97be-eb477d100352',
      'Nissan GT-R R35',
      'E85 tune results - 850whp!',
      'Just finished my E85 tune with AMS. Made 850whp on the dyno! Car feels like a rocket now. Highly recommend going E85 if you have access.',
      ARRAY['https://picsum.photos/800/600?random=907']
    )
  RETURNING id INTO post4_id;

  -- Add likes to posts
  INSERT INTO post_likes (post_id, user_id)
  VALUES
    (post1_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4'),
    (post1_id, '33c95074-90c4-4891-809c-ae1e32691aa5'),
    (post2_id, '186dc8cb-c6dd-4e79-97be-eb477d100352'),
    (post2_id, '33c95074-90c4-4891-809c-ae1e32691aa5'),
    (post3_id, '186dc8cb-c6dd-4e79-97be-eb477d100352'),
    (post3_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4'),
    (post4_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4'),
    (post4_id, '33c95074-90c4-4891-809c-ae1e32691aa5');

  -- Add comments
  INSERT INTO forum_comments (post_id, user_id, content)
  VALUES
    (post1_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', 'I have Armytrix on my R34. Sounds amazing! Not too loud for daily use.'),
    (post1_id, '33c95074-90c4-4891-809c-ae1e32691aa5', 'Akrapovic is great too, but Armytrix has better sound IMO.'),
    (post2_id, '186dc8cb-c6dd-4e79-97be-eb477d100352', 'Wow! That looks incredible. Great work!'),
    (post2_id, '33c95074-90c4-4891-809c-ae1e32691aa5', 'Beautiful restoration! How long did it take?'),
    (post3_id, '186dc8cb-c6dd-4e79-97be-eb477d100352', 'Nice! How did it handle compared to stock R35?'),
    (post4_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', 'Thats insane power! What turbo setup are you running?');
END $$;

-- ============================================================================
-- STEP 7: CREATE EVENTS
-- ============================================================================

DO $$
DECLARE
  event1_id UUID;
  event2_id UUID;
BEGIN
  -- Event 1: Track Day
  INSERT INTO events (created_by, title, description, event_type, location, latitude, longitude, start_date, end_date, max_attendees, cover_image_url)
  VALUES
    (
      '186dc8cb-c6dd-4e79-97be-eb477d100352',
      'GT-R Track Day at Laguna Seca',
      'Join us for an exclusive GT-R track day at WeatherTech Raceway Laguna Seca. All GT-R models welcome!',
      'Track Day',
      'WeatherTech Raceway Laguna Seca, Monterey, CA',
      36.5847,
      -121.7533,
      NOW() + INTERVAL '30 days',
      NOW() + INTERVAL '30 days' + INTERVAL '8 hours',
      50,
      'https://picsum.photos/1200/600?random=1001'
    )
  RETURNING id INTO event1_id;

  -- Event 2: Car Meet
  INSERT INTO events (created_by, title, description, event_type, location, latitude, longitude, start_date, end_date, max_attendees, cover_image_url)
  VALUES
    (
      '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
      'Miami GT-R Meet & Greet',
      'Monthly GT-R meetup at Miami Beach. Food trucks, photo ops, and great company!',
      'Car Meet',
      'Miami Beach, FL',
      25.7907,
      -80.1300,
      NOW() + INTERVAL '14 days',
      NOW() + INTERVAL '14 days' + INTERVAL '4 hours',
      100,
      'https://picsum.photos/1200/600?random=1002'
    )
  RETURNING id INTO event2_id;

  -- Add RSVPs
  INSERT INTO event_rsvps (event_id, user_id, status)
  VALUES
    (event1_id, '186dc8cb-c6dd-4e79-97be-eb477d100352', 'going'),
    (event1_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', 'going'),
    (event1_id, '33c95074-90c4-4891-809c-ae1e32691aa5', 'maybe'),
    (event2_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', 'going'),
    (event2_id, '186dc8cb-c6dd-4e79-97be-eb477d100352', 'going'),
    (event2_id, '33c95074-90c4-4891-809c-ae1e32691aa5', 'going');
END $$;

-- ============================================================================
-- STEP 8: CREATE CONVERSATIONS AND MESSAGES
-- ============================================================================

DO $$
DECLARE
  conv1_id UUID;
  conv2_id UUID;
BEGIN
  -- Conversation between User 1 and User 2
  INSERT INTO conversations (user1_id, user2_id, last_message_at, last_message_preview)
  VALUES
    (
      '186dc8cb-c6dd-4e79-97be-eb477d100352',
      '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
      NOW() - INTERVAL '2 hours',
      'Thanks for the info about the exhaust!'
    )
  RETURNING id INTO conv1_id;

  -- Conversation between User 2 and User 3
  INSERT INTO conversations (user1_id, user2_id, last_message_at, last_message_preview)
  VALUES
    (
      '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
      '33c95074-90c4-4891-809c-ae1e32691aa5',
      NOW() - INTERVAL '1 day',
      'See you at the track day!'
    )
  RETURNING id INTO conv2_id;

  -- Messages for Conversation 1
  INSERT INTO messages (conversation_id, sender_id, recipient_id, content, is_read)
  VALUES
    (conv1_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', '186dc8cb-c6dd-4e79-97be-eb477d100352', 'Hey! I saw your post about exhaust systems. I have Armytrix on my R34 and love it!', true),
    (conv1_id, '186dc8cb-c6dd-4e79-97be-eb477d100352', '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', 'Thanks for the info! How loud is it for daily driving?', true),
    (conv1_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', '186dc8cb-c6dd-4e79-97be-eb477d100352', 'Its perfect for daily use. Not too loud but sounds amazing when you get on it.', true),
    (conv1_id, '186dc8cb-c6dd-4e79-97be-eb477d100352', '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', 'Thanks for the info!', false);

  -- Messages for Conversation 2
  INSERT INTO messages (conversation_id, sender_id, recipient_id, content, is_read)
  VALUES
    (conv2_id, '33c95074-90c4-4891-809c-ae1e32691aa5', '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', 'Hey! Are you going to the Miami meet next week?', true),
    (conv2_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', '33c95074-90c4-4891-809c-ae1e32691aa5', 'Yes! Ill be there with my R34. See you there!', true),
    (conv2_id, '33c95074-90c4-4891-809c-ae1e32691aa5', '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', 'See you at the track day!', false);
END $$;

-- ============================================================================
-- STEP 9: CREATE PARTS LISTINGS
-- ============================================================================

INSERT INTO parts_listings (user_id, title, part_name, part_number, compatible_models, price, condition, description, image_urls, status)
VALUES
  (
    '186dc8cb-c6dd-4e79-97be-eb477d100352',
    'AMS Alpha 10 Turbo Kit - Used',
    'Turbo Kit',
    'AMS-ALPHA10',
    ARRAY['Nissan GT-R R35'],
    4500.00,
    'Good',
    'Used AMS Alpha 10 turbo kit. About 10k miles on it. Upgrading to Alpha 12. Great condition.',
    ARRAY['https://picsum.photos/800/600?random=1101', 'https://picsum.photos/800/600?random=1102'],
    'active'
  ),
  (
    '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
    'HKS Hi-Power Exhaust System R34',
    'Exhaust System',
    'HKS-R34-HP',
    ARRAY['Nissan GT-R R34'],
    1200.00,
    'Excellent',
    'HKS Hi-Power exhaust for R34. Barely used, like new condition. Sounds amazing!',
    ARRAY['https://picsum.photos/800/600?random=1103'],
    'active'
  ),
  (
    '33c95074-90c4-4891-809c-ae1e32691aa5',
    'Nismo Wheels Set of 4',
    'Wheels',
    'NISMO-GTR-WHEELS',
    ARRAY['Nissan GT-R R35', 'Nissan GT-R Nismo'],
    2800.00,
    'Like New',
    'OEM Nismo wheels. Perfect condition. Only 500 miles on them.',
    ARRAY['https://picsum.photos/800/600?random=1104', 'https://picsum.photos/800/600?random=1105'],
    'active'
  ),
  (
    '186dc8cb-c6dd-4e79-97be-eb477d100352',
    'Cobb Accessport V3 for GT-R',
    'ECU Tuning Device',
    'COBB-AP-GTR',
    ARRAY['Nissan GT-R R35'],
    650.00,
    'Excellent',
    'Cobb Accessport V3. Unmarried and ready to use. Includes all cables.',
    ARRAY['https://picsum.photos/800/600?random=1106'],
    'active'
  );

-- ============================================================================
-- STEP 10: CREATE COMMUNITY MEDIA
-- ============================================================================

DO $$
DECLARE
  media1_id UUID;
  media2_id UUID;
  media3_id UUID;
BEGIN
  -- Media Post 1: Video
  INSERT INTO community_media (user_id, model, title, description, media_type, media_url, thumbnail_url, storage_path, tags)
  VALUES
    (
      '186dc8cb-c6dd-4e79-97be-eb477d100352',
      'Nissan GT-R R35',
      'Track Day Highlights',
      'Some highlights from my last track day. Car performed flawlessly!',
      'video',
      'https://picsum.photos/1920/1080?random=1201',
      'https://picsum.photos/800/450?random=1202',
      'community-media/track-day-1.mp4',
      ARRAY['track', 'r35', 'racing', 'performance']
    )
  RETURNING id INTO media1_id;

  -- Media Post 2: Photo
  INSERT INTO community_media (user_id, model, title, description, media_type, media_url, thumbnail_url, storage_path, tags)
  VALUES
    (
      '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
      'Nissan GT-R R34',
      'Sunset Shoot',
      'Got some amazing shots at sunset with my R34.',
      'image',
      'https://picsum.photos/1920/1080?random=1203',
      'https://picsum.photos/800/450?random=1204',
      'community-media/sunset-r34.jpg',
      ARRAY['r34', 'photography', 'sunset', 'jdm']
    )
  RETURNING id INTO media2_id;

  -- Media Post 3: Photo
  INSERT INTO community_media (user_id, model, title, description, media_type, media_url, thumbnail_url, storage_path, tags)
  VALUES
    (
      '33c95074-90c4-4891-809c-ae1e32691aa5',
      'Nissan GT-R Nismo',
      'First Wash',
      'Gave my new Nismo its first detail. Looking fresh!',
      'image',
      'https://picsum.photos/1920/1080?random=1205',
      'https://picsum.photos/800/450?random=1206',
      'community-media/nismo-detail.jpg',
      ARRAY['nismo', 'detail', 'new', 'clean']
    )
  RETURNING id INTO media3_id;

  -- Add likes to media
  INSERT INTO media_likes (media_id, user_id)
  VALUES
    (media1_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4'),
    (media1_id, '33c95074-90c4-4891-809c-ae1e32691aa5'),
    (media2_id, '186dc8cb-c6dd-4e79-97be-eb477d100352'),
    (media2_id, '33c95074-90c4-4891-809c-ae1e32691aa5'),
    (media3_id, '186dc8cb-c6dd-4e79-97be-eb477d100352'),
    (media3_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4');

  -- Add comments to media
  INSERT INTO media_comments (media_id, user_id, content)
  VALUES
    (media1_id, '2e54e24f-85ab-47ef-96ff-6b69b148d2c4', 'Awesome footage! What track was this?'),
    (media1_id, '33c95074-90c4-4891-809c-ae1e32691aa5', 'Car sounds amazing!'),
    (media2_id, '186dc8cb-c6dd-4e79-97be-eb477d100352', 'Beautiful shots! R34 is timeless.'),
    (media3_id, '186dc8cb-c6dd-4e79-97be-eb477d100352', 'Looking clean! Congrats on the new ride.');
END $$;

-- ============================================================================
-- STEP 11: CREATE SAVED SEARCHES
-- ============================================================================

INSERT INTO saved_searches (user_id, search_name, search_query, model, min_price, max_price, min_year, max_year, condition, city, state, is_active)
VALUES
  (
    '186dc8cb-c6dd-4e79-97be-eb477d100352',
    'R35 Under 100k',
    'GT-R R35',
    'Nissan GT-R R35',
    50000.00,
    100000.00,
    2017,
    2024,
    ARRAY['Excellent', 'Very Good'],
    'Los Angeles',
    'CA',
    true
  ),
  (
    '2e54e24f-85ab-47ef-96ff-6b69b148d2c4',
    'R34 Skyline',
    'Skyline R34',
    'Nissan GT-R R34',
    100000.00,
    250000.00,
    1999,
    2002,
    ARRAY['Excellent'],
    NULL,
    NULL,
    true
  ),
  (
    '33c95074-90c4-4891-809c-ae1e32691aa5',
    'Nismo Edition',
    'Nismo',
    'Nissan GT-R Nismo',
    200000.00,
    250000.00,
    2020,
    2024,
    ARRAY['Like New', 'Excellent'],
    NULL,
    NULL,
    true
  );

-- ============================================================================
-- SEED DATA COMPLETE!
-- ============================================================================
-- Summary:
-- ✓ 3 User profiles updated
-- ✓ 7 Model specs created
-- ✓ 8 Car listings (7 active, 1 sold)
-- ✓ 20+ Listing images
-- ✓ 4 User garage entries
-- ✓ 4 Forum posts with comments and likes
-- ✓ 2 Events with RSVPs
-- ✓ 2 Conversations with messages
-- ✓ 4 Parts listings
-- ✓ 3 Community media posts with likes and comments
-- ✓ 3 Saved searches
--
-- All data uses placeholder images from picsum.photos
-- You can replace these URLs later with actual Supabase Storage URLs
-- ============================================================================

