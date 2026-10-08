-- Starting catalog, taken from the website (academy.html and services.html, Oct 2026).
-- Mom edits prices and names in the app (More → Catalog); this only runs once.
-- Ranged prices ('₹450–1,150') store the low end as the default and the range in
-- price_min/price_max, so staff type the actual amount.

-- ============================================================
-- Courses
-- ============================================================
insert into public.courses (code, name_en, name_hi, duration_months, list_fee, sort) values
  ('hair',   'Hair Course',                'हेयर कोर्स',               3,   20000, 2),
  ('makeup', 'Professional Makeup Course', 'प्रोफेशनल मेकअप कोर्स',      1.5, 30000, 1),
  ('salon',  'Salon Basic Course',         'सैलून बेसिक कोर्स',          3,   40000, 3);

insert into public.courses (code, name_en, name_hi, duration_months, list_fee, is_combo, included_course_ids, sort)
select 'combo', 'Complete Beautician Combo', 'कम्प्लीट ब्यूटीशियन कॉम्बो', 6, 60000, true,
       array(select id from public.courses where code in ('salon', 'makeup', 'hair') order by sort), 0;

insert into public.course_modules (course_id, title_en, title_hi, topics, sort)
select c.id, m.title_en, m.title_hi, m.topics, m.sort
from public.courses c
join (values
  ('hair', 'Foundations', 'बुनियादी ज्ञान', 'Hair theory & structure; understanding hair chemicals', 1),
  ('hair', 'Chemical Treatments', 'केमिकल ट्रीटमेंट', 'Smoothening, rebonding & straightening', 2),
  ('hair', 'Haircutting', 'हेयरकटिंग', 'Trimming; V-cut, U-cut, Bob cut; step cut; feather cut', 3),
  ('hair', 'Care & Treatments', 'केयर और ट्रीटमेंट', 'Deep oil conditioning; hair spa', 4),
  ('hair', 'Colouring', 'हेयर कलरिंग', 'Global colour; highlights; balayage/ombré; funky fashion colours', 5),
  ('makeup', 'Skin Prep & Base', 'स्किन प्रेप और बेस', 'Skin preparation and priming; colour correction; concealing spots, pigmentation & dark circles; foundation types & application; cream and powder contouring & highlighting; base across light, medium and deep skin tones', 1),
  ('makeup', 'Eye Makeup', 'आई मेकअप', 'Smokey eyes (types, intensity, black & coloured); bridal eye makeup; cut crease; multi-coloured eyes; smudged & winged liner; eyebrow defining; false lashes', 2),
  ('makeup', 'Draping', 'ड्रेपिंग', 'Dupatta and saree draping', 3),
  ('makeup', 'Occasion Looks', 'अवसर के लुक्स', 'Day, Night, Engagement, Haldi, Mehndi, Bridal, Cocktail, Reception, Model looks', 4),
  ('salon', 'Grooming & Hair Removal', 'ग्रूमिंग और हेयर रिमूवल', 'Threading; eyebrow shaping; types of waxing', 1),
  ('salon', 'Hand & Foot Care', 'हाथ-पैर की देखभाल', 'Manicure; pedicure', 2),
  ('salon', 'Skin & Facial Care', 'स्किन और फेशियल केयर', 'Skin types; cleanup; facials; bleach', 3)
) as m (code, title_en, title_hi, topics, sort) on m.code = c.code;

-- ============================================================
-- Salon services, grouped in the order staff reach for them most.
-- ============================================================
create temporary table seed_services (
  cat_sort int, cat_en text, cat_hi text,
  name_en text, name_hi text, price int, price_min int, price_max int, is_variable boolean, sort int
) on commit drop;

insert into seed_services values
  -- Waxing & Threading
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Threading (eyebrows, forehead, upper lip, chin)', 'थ्रेडिंग (आइब्रो, माथा, अपर लिप, ठुड्डी)', 30, 30, 50, false, 1),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Full face threading', 'फुल फेस थ्रेडिंग', 200, null, null, false, 2),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Face wax (lips, nose, chin, forehead)', 'फेस वैक्स (होंठ, नाक, ठुड्डी, माथा)', 50, 50, 100, false, 3),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Full face wax', 'फुल फेस वैक्स', 350, null, null, false, 4),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Rica wax · Underarms', 'रीका वैक्स · अंडरआर्म्स', 150, null, null, false, 5),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Rica wax · Full arms', 'रीका वैक्स · फुल आर्म्स', 350, null, null, false, 6),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Rica wax · Full legs', 'रीका वैक्स · फुल लेग्स', 750, null, null, false, 7),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Rica wax · Full body', 'रीका वैक्स · फुल बॉडी', 4000, null, null, false, 8),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Chocolate / Aloe vera wax · Underarms', 'चॉकलेट / एलोवेरा वैक्स · अंडरआर्म्स', 100, null, null, false, 9),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Chocolate / Aloe vera wax · Full arms', 'चॉकलेट / एलोवेरा वैक्स · फुल आर्म्स', 200, null, null, false, 10),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Chocolate / Aloe vera wax · Full legs', 'चॉकलेट / एलोवेरा वैक्स · फुल लेग्स', 400, null, null, false, 11),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Chocolate / Aloe vera wax · Full body', 'चॉकलेट / एलोवेरा वैक्स · फुल बॉडी', 1800, null, null, false, 12),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Simple wax · Underarms', 'सिंपल वैक्स · अंडरआर्म्स', 100, null, null, false, 13),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Simple wax · Full arms', 'सिंपल वैक्स · फुल आर्म्स', 150, null, null, false, 14),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Simple wax · Full legs', 'सिंपल वैक्स · फुल लेग्स', 320, null, null, false, 15),
  (1, 'Waxing & Threading', 'वैक्स और थ्रेडिंग', 'Simple wax · Full body', 'सिंपल वैक्स · फुल बॉडी', 1500, null, null, false, 16),
  -- Facials & Cleanups
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'Basic cleanup', 'बेसिक क्लीनअप', 250, 250, 550, false, 1),
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'Premium cleanup', 'प्रीमियम क्लीनअप', 750, 750, 1150, false, 2),
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'Luxury cleanup (with power mask)', 'लग्ज़री क्लीनअप (पावर मास्क के साथ)', 1250, 1250, 1550, false, 3),
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'Everyday facial (Multivitamin, Vitamin C, Whitening)', 'साधारण फेशियल (मल्टीविटामिन, विटामिन C, व्हाइटनिंग)', 450, 450, 1150, false, 4),
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'Diamond / Gold / Pearl facial', 'डायमंड / गोल्ड / पर्ल फेशियल', 1250, 1250, 1850, false, 5),
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'Korean anti-ageing facial', 'कोरियन एंटी-एजिंग फेशियल', 1650, 1650, 2000, false, 6),
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'O3+ facial (Vitamin C, Brightening, Power Mask)', 'O3+ फेशियल (विटामिन C, ब्राइटनिंग, पावर मास्क)', 2000, 2000, 2500, false, 7),
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'Hydra facial', 'हाइड्रा फेशियल', 3000, null, null, false, 8),
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'Aroma Hydra facial', 'अरोमा हाइड्रा फेशियल', 4000, null, null, false, 9),
  (2, 'Facials & Cleanups', 'फेशियल और क्लीनअप', 'Korean Hydra facial', 'कोरियन हाइड्रा फेशियल', 5000, null, null, false, 10),
  -- Hair
  (3, 'Hair', 'हेयर', 'Hair trimming', 'हेयर ट्रिमिंग', 250, null, null, false, 1),
  (3, 'Hair', 'हेयर', 'U/V or laser cut', 'U/V या लेज़र कट', 350, null, null, false, 2),
  (3, 'Hair', 'हेयर', 'Step cut', 'स्टेप कट', 450, null, null, false, 3),
  (3, 'Hair', 'हेयर', 'Feather cut', 'फेदर कट', 550, null, null, false, 4),
  (3, 'Hair', 'हेयर', 'Butterfly cut', 'बटरफ्लाई कट', 650, null, null, false, 5),
  (3, 'Hair', 'हेयर', 'Advanced cut', 'एडवांस्ड कट', 750, null, null, false, 6),
  (3, 'Hair', 'हेयर', 'Dryer setting', 'ड्रायर सेटिंग', 200, null, null, false, 7),
  (3, 'Hair', 'हेयर', 'Temporary straightening', 'टेम्पररी स्ट्रेटनिंग', 450, null, null, false, 8),
  (3, 'Hair', 'हेयर', 'Hair styling', 'हेयर स्टाइलिंग', 550, null, null, true, 9),
  (3, 'Hair', 'हेयर', 'Deep conditioning, oil (as per length)', 'डीप कंडीशनिंग, तेल (लंबाई अनुसार)', 550, null, null, true, 10),
  (3, 'Hair', 'हेयर', 'Hair spa, cream (as per length)', 'हेयर स्पा, क्रीम (लंबाई अनुसार)', 1550, null, null, true, 11),
  -- Bleach & Mani-Pedi
  (4, 'Bleach & Mani-Pedi', 'ब्लीच और मैनी-पेडी', 'Face bleach (Normal, Gold, Oxy, Diamond)', 'फेस ब्लीच (नॉर्मल, गोल्ड, ऑक्सी, डायमंड)', 200, 200, 350, false, 1),
  (4, 'Bleach & Mani-Pedi', 'ब्लीच और मैनी-पेडी', 'Body bleach (arms, legs, front, back)', 'बॉडी ब्लीच (हाथ, पैर, आगे, पीछे)', 500, 500, 900, false, 2),
  (4, 'Bleach & Mani-Pedi', 'ब्लीच और मैनी-पेडी', 'Full body bleach', 'फुल बॉडी ब्लीच', 3000, null, null, false, 3),
  (4, 'Bleach & Mani-Pedi', 'ब्लीच और मैनी-पेडी', 'Manicure (basic, detan, power mask)', 'मैनीक्योर (बेसिक, डी-टैन, पावर मास्क)', 450, 450, 1500, false, 4),
  (4, 'Bleach & Mani-Pedi', 'ब्लीच और मैनी-पेडी', 'Pedicure (basic, detan, power mask)', 'पेडीक्योर (बेसिक, डी-टैन, पावर मास्क)', 650, 650, 1500, false, 5),
  -- Party Makeup
  (5, 'Party Makeup', 'पार्टी मेकअप', 'Party makeup · Junior artist', 'पार्टी मेकअप · जूनियर आर्टिस्ट', 1500, null, null, false, 1),
  (5, 'Party Makeup', 'पार्टी मेकअप', 'Party makeup · Senior artist (PAC)', 'पार्टी मेकअप · सीनियर आर्टिस्ट (PAC)', 2000, null, null, false, 2),
  (5, 'Party Makeup', 'पार्टी मेकअप', 'Party makeup · Senior artist (Forever52)', 'पार्टी मेकअप · सीनियर आर्टिस्ट (Forever52)', 2500, null, null, false, 3),
  (5, 'Party Makeup', 'पार्टी मेकअप', 'Party makeup · Namita Garg (PAC)', 'पार्टी मेकअप · नमिता गर्ग (PAC)', 2500, null, null, false, 4),
  (5, 'Party Makeup', 'पार्टी मेकअप', 'Party makeup · Namita Garg (Forever52)', 'पार्टी मेकअप · नमिता गर्ग (Forever52)', 3000, null, null, false, 5),
  (5, 'Party Makeup', 'पार्टी मेकअप', 'Party makeup · Namita Garg (MAC)', 'पार्टी मेकअप · नमिता गर्ग (MAC)', 3500, null, null, false, 6),
  -- Bridal Makeup
  (6, 'Bridal Makeup', 'ब्राइडल मेकअप', 'Bridal makeup · Kryolan', 'ब्राइडल मेकअप · Kryolan', 10000, null, null, false, 1),
  (6, 'Bridal Makeup', 'ब्राइडल मेकअप', 'Bridal makeup · PAC', 'ब्राइडल मेकअप · PAC', 15000, null, null, false, 2),
  (6, 'Bridal Makeup', 'ब्राइडल मेकअप', 'Bridal makeup · Forever52', 'ब्राइडल मेकअप · Forever52', 20000, null, null, false, 3),
  (6, 'Bridal Makeup', 'ब्राइडल मेकअप', 'Bridal makeup · MAC', 'ब्राइडल मेकअप · MAC', 23000, null, null, false, 4),
  (6, 'Bridal Makeup', 'ब्राइडल मेकअप', 'Bridal makeup · Airbrush', 'ब्राइडल मेकअप · Airbrush', 28000, null, null, false, 5),
  -- Engagement Makeup
  (7, 'Engagement Makeup', 'इंगेजमेंट मेकअप', 'Engagement makeup · Kryolan', 'इंगेजमेंट मेकअप · Kryolan', 8000, null, null, false, 1),
  (7, 'Engagement Makeup', 'इंगेजमेंट मेकअप', 'Engagement makeup · PAC', 'इंगेजमेंट मेकअप · PAC', 12000, null, null, false, 2),
  (7, 'Engagement Makeup', 'इंगेजमेंट मेकअप', 'Engagement makeup · Forever52', 'इंगेजमेंट मेकअप · Forever52', 15000, null, null, false, 3),
  (7, 'Engagement Makeup', 'इंगेजमेंट मेकअप', 'Engagement makeup · MAC', 'इंगेजमेंट मेकअप · MAC', 18000, null, null, false, 4),
  (7, 'Engagement Makeup', 'इंगेजमेंट मेकअप', 'Engagement makeup · Airbrush', 'इंगेजमेंट मेकअप · Airbrush', 20000, null, null, false, 5),
  -- Packages (until bookings arrive in phase 2, payments for these are logged as services)
  (8, 'Bridal Packages', 'ब्राइडल पैकेज', 'Bridal package · Basic', 'ब्राइडल पैकेज · बेसिक', 15000, null, null, false, 1),
  (8, 'Bridal Packages', 'ब्राइडल पैकेज', 'Bridal package · Classic', 'ब्राइडल पैकेज · क्लासिक', 20000, null, null, false, 2),
  (8, 'Bridal Packages', 'ब्राइडल पैकेज', 'Bridal package · Deluxe', 'ब्राइडल पैकेज · डीलक्स', 25000, null, null, false, 3),
  (8, 'Bridal Packages', 'ब्राइडल पैकेज', 'Bridal package · Premium', 'ब्राइडल पैकेज · प्रीमियम', 30000, null, null, false, 4),
  (8, 'Bridal Packages', 'ब्राइडल पैकेज', 'Bridal package · Luxury', 'ब्राइडल पैकेज · लग्ज़री', 40000, null, null, false, 5),
  (9, 'Engagement Packages', 'इंगेजमेंट पैकेज', 'Engagement package · Basic', 'इंगेजमेंट पैकेज · बेसिक', 14000, null, null, false, 1),
  (9, 'Engagement Packages', 'इंगेजमेंट पैकेज', 'Engagement package · Classic', 'इंगेजमेंट पैकेज · क्लासिक', 16000, null, null, false, 2),
  (9, 'Engagement Packages', 'इंगेजमेंट पैकेज', 'Engagement package · Deluxe', 'इंगेजमेंट पैकेज · डीलक्स', 18000, null, null, false, 3),
  (9, 'Engagement Packages', 'इंगेजमेंट पैकेज', 'Engagement package · Premium', 'इंगेजमेंट पैकेज · प्रीमियम', 25000, null, null, false, 4),
  (9, 'Engagement Packages', 'इंगेजमेंट पैकेज', 'Engagement package · Luxury', 'इंगेजमेंट पैकेज · लग्ज़री', 28000, null, null, false, 5),
  (10, 'Pre-Bridal Packages', 'प्री-ब्राइडल पैकेज', 'Pre-bridal package · Classic', 'प्री-ब्राइडल पैकेज · क्लासिक', 10000, null, null, false, 1),
  (10, 'Pre-Bridal Packages', 'प्री-ब्राइडल पैकेज', 'Pre-bridal package · Deluxe', 'प्री-ब्राइडल पैकेज · डीलक्स', 13000, null, null, false, 2),
  (10, 'Pre-Bridal Packages', 'प्री-ब्राइडल पैकेज', 'Pre-bridal package · Premium', 'प्री-ब्राइडल पैकेज · प्रीमियम', 15000, null, null, false, 3),
  (10, 'Pre-Bridal Packages', 'प्री-ब्राइडल पैकेज', 'Pre-bridal package · Luxury', 'प्री-ब्राइडल पैकेज · लग्ज़री', 20000, null, null, false, 4);

insert into public.service_categories (name_en, name_hi, sort)
select distinct cat_en, cat_hi, cat_sort from seed_services;

insert into public.services (category_id, name_en, name_hi, price, price_min, price_max, is_variable, sort)
select c.id, s.name_en, s.name_hi, s.price, s.price_min, s.price_max, s.is_variable, s.sort
from seed_services s
join public.service_categories c on c.name_en = s.cat_en;
