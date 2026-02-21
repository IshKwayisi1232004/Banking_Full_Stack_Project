- Database Structures:
    
DB1: Core DB (State Layer)
This database acts as the primary source for current account balances and user authentication.

SQL Schema:

SQL
-- Users Table: Identity management
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL, 
    psw TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts Table: Financial state
CREATE TABLE accounts (
    acc_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES users(id), -- Linked to users
    balance NUMERIC DEFAULT 0, -- Uses NUMERIC to avoid rounding errors
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


DB2: Ledger DB (Audit Layer)
This database records every movement of funds to ensure a perfect audit trail. It follows the double-entry principle where every transaction consists of at least two entries that sum to zero.

SQL Schema:
-- Transactions Table: Event record with status tracking
CREATE TABLE transactions (
    trx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_acc UUID NOT NULL, 
    to_acc UUID NOT NULL,   
    amount NUMERIC NOT NULL CHECK (amount > 0),
    status TEXT DEFAULT 'pending', -- tracks 2PC state (pending/completed/failed)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entries Table: Granular double-entry bookkeeping
CREATE TABLE entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trx_id UUID REFERENCES transactions(trx_id) ON DELETE CASCADE,
    acc_id UUID NOT NULL, 
    amount NUMERIC NOT NULL, -- Recorded as -100 (sender) or +100 (receiver)
    created_at TIMESTAMPTZ DEFAULT NOW()
);


- Data Flow & Transaction Logic:
To maintain consistency across separate databases, the application demonstrates a Two-Phase Commit protocol.

Example Scenario: User A transfers $100 to User B
Initiation (Ledger DB):

A record is inserted into transactions with a status of 'pending'.

Two rows are inserted into entries: one for User A (-100) and one for User B (+100).

The Prepare Phase (2PC):

The application issues PREPARE TRANSACTION 'transfer_01' to both DBs via Port 5432.

Core DB checks if User A has sufficient funds.

Ledger DB ensures the entries are valid.

The Commit Phase (2PC):

If both return a success signal, the application issues COMMIT PREPARED 'transfer_01'.

Core DB updates the balance columns for both accounts.

Ledger DB updates the transaction status to 'completed'.
