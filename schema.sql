-- VRMS database schema
-- Run this once against your Neon database (Neon SQL Editor, or psql).

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(30),
    role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','staff','admin')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
    id SERIAL PRIMARY KEY,
    make VARCHAR(80) NOT NULL,
    model VARCHAR(80) NOT NULL,
    year INT NOT NULL,
    plate_number VARCHAR(30) UNIQUE NOT NULL,
    category VARCHAR(40) NOT NULL DEFAULT 'sedan',
    daily_rate NUMERIC(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available','maintenance','retired')),
    image_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','confirmed','active','completed','cancelled')),
    total_amount NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (end_date > start_date)
);

CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    method VARCHAR(30) NOT NULL DEFAULT 'card',
    status VARCHAR(20) NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','refunded','failed')),
    paid_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicle_returns (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    return_date DATE NOT NULL,
    condition_notes TEXT,
    late_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS maintenance (
    id SERIAL PRIMARY KEY,
    vehicle_id INT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    cost NUMERIC(10,2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled','in_progress','completed')),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    type VARCHAR(30) NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- A little sample data so the site isn't empty on first run.
INSERT INTO vehicles (make, model, year, plate_number, category, daily_rate, image_url)
VALUES
 ('Toyota', 'Corolla', 2023, 'CA123456', 'sedan', 450.00, 'https://images.unsplash.com/photo-1623869675184-2b3c3d1b3b1a?w=600'),
 ('Volkswagen', 'Polo', 2022, 'CA654321', 'hatchback', 380.00, 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=600'),
 ('Ford', 'Ranger', 2023, 'CA987654', 'bakkie', 750.00, 'https://images.unsplash.com/photo-1594502184342-2e12f877aa73?w=600')
ON CONFLICT (plate_number) DO NOTHING;
