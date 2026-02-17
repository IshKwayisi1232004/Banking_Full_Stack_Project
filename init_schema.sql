-CORE DB SCHEMA (Users, Accounts, Balances)

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    psw TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE accounts (
    acc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE balances (
    acc_id UUID PRIMARY KEY REFERENCES accounts(acc_id) ON DELETE CASCADE,
    amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);



-LEDGER DB SCHEMA (Transactions, Entries)

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_usr_id UUID NOT NULL, 
    to_usr_id UUID NOT NULL,   
    amount DECIMAL(15, 2) NOT NULL,
    status TEXT DEFAULT 'pending', 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    acc_id UUID NOT NULL, 
    amount DECIMAL(15, 2) NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`