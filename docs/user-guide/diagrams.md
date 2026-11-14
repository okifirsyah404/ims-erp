# Diagrams — business flows (UML)

Mermaid diagrams of the M02 (sales), M05 (procurement, inventory) and M07
(projects, after-sales) flows as implemented on `merge/main-sync`
(ADR-0011 port, 2026-11-06). They render on GitHub and in VS Code (Markdown
preview with Mermaid). State names are the values stored in the database;
the Indonesian screen label is given after the slash.

Used by both guides: [English](en.md) · [Bahasa Indonesia](id.md).

## 1. End-to-end flow (activity)

```mermaid
flowchart LR
    subgraph Sales["Sales / Penjualan (M02)"]
        Q[SPH / quotation] -->|approve + send| QD{Customer agrees?}
        QD -->|asks for changes| R[Revision -R1, -R2 …] --> Q
        QD -->|no| L[Lost / Batal]
        QD -->|yes| SO[Sales order — SPH becomes Deal]
        SO --> INV[Invoices: DP / term / settlement]
        INV --> RC[Receipts / kuitansi]
    end
    subgraph Purchasing["Procurement / Pengadaan (M05)"]
        PO[Purchase order] -->|approve + send| SUP((Supplier))
        SUP -->|goods arrive| GR[Goods receipt / BPB]
    end
    subgraph Warehouse["Inventory / Gudang (M05)"]
        GR -->|stock in at ex-VAT cost| ST[(Stock + average cost)]
        OPEN[Opening stock / adjustment] --> ST
        ST -->|stock out at average cost| DN[Delivery note / surat jalan]
    end
    SO --> DN
    SO -. buy for the deal .-> PO
    subgraph Projects["Projects & after-sales (M07)"]
        PRJ[Project from the deal] --> BAST[BAST]
        BAST --> W[Warranty certificate]
        W --> T[Service tickets]
    end
    SO --> PRJ
    DN -->|serials sold to customer| W
```

## 2. Sales: quotation to cash (sequence)

```mermaid
sequenceDiagram
    actor S as Sales
    actor M as Manager / owner
    actor F as Finance
    participant Q as SPH
    participant O as Sales order
    participant I as Invoice
    participant K as Receipt (kuitansi)
    S->>Q: create (draft), edit lines, terms
    S->>Q: submit for approval
    M->>Q: approve (never one's own) / reject
    S->>Q: print, mark sent
    opt customer asks for changes
        S->>Q: create revision → new draft -R1, old one superseded
        S->>Q: submit → approve → send again
    end
    S->>O: create sales order from the approved/sent SPH
    Note over Q,O: SPH becomes won (Deal), cancelling the order reopens it
    F->>I: create draft from the order (DP %, next term or amount)
    F->>I: issue (numbered), print
    F->>K: record payment
    K-->>I: partially_paid → paid
```

## 3. Purchasing to stock (sequence)

```mermaid
sequenceDiagram
    actor P as Purchasing
    actor M as Owner / approver
    actor G as Warehouse
    participant PO as Purchase order
    participant GR as Goods receipt (BPB)
    participant ST as Stock ledger
    participant U as Serial units
    P->>PO: create draft (supplier, category, VAT mode, lines)
    P->>PO: submit
    M->>PO: approve (numbered) / reject → back to draft
    P->>PO: print, mark sent to supplier
    G->>GR: receive what arrived (partial allowed, serials per unit)
    GR->>ST: receipt movement at ex-VAT unit cost → moving average
    GR->>U: one unit per serial, in_stock
    GR-->>PO: partially_received → received
```

## 4. Delivery note (sequence)

```mermaid
sequenceDiagram
    actor G as Warehouse
    participant SO as Sales order
    participant DN as Delivery note
    participant ST as Stock ledger
    participant U as Serial units
    G->>DN: prepare from the order (warehouse, quantities ≤ open, serials) — numbered SJ
    G->>DN: print for the driver
    G->>DN: ship
    DN->>ST: issue movement at the moving-average cost
    DN->>U: serial units sold to the customer
    DN-->>SO: confirmed → in_progress
    G->>DN: mark delivered (receiver name)
```

## 5. Document states

### SPH (quotation)

```mermaid
stateDiagram-v2
    [*] --> draft: create / Draf
    draft --> submitted: submit / Ajukan
    submitted --> approved: approve / Setujui
    submitted --> rejected: reject / Tolak
    approved --> sent: mark sent / Terkirim
    approved --> won: sales order created / Deal
    sent --> won: sales order created / Deal
    won --> sent: order cancelled (reopened)
    submitted --> superseded: revise
    approved --> superseded: revise
    rejected --> superseded: revise
    sent --> superseded: revise
    lost --> superseded: revise
    draft --> lost: Batal
    submitted --> lost
    approved --> lost
    rejected --> lost
    sent --> lost
    superseded --> [*]
    note right of superseded: the revision is a new draft (-R1, -R2 …)
```

### Sales order and invoice

```mermaid
stateDiagram-v2
    state "Sales order" as SO {
        [*] --> confirmed
        confirmed --> in_progress: first delivery note shipped
        confirmed --> cancelled: cancel (no invoices, notes or project)
    }
    state "Invoice" as INV {
        [*] --> draft: create (unnumbered)
        draft --> issued: issue (numbered)
        issued --> partially_paid: receipt
        partially_paid --> paid: receipts cover the total
        draft --> void
        issued --> void: void (reverse receipts first)
    }
```

### Purchase order and stock adjustment

```mermaid
stateDiagram-v2
    state "Purchase order" as PO {
        [*] --> draft
        draft --> submitted: submit
        submitted --> approved: approve (numbered)
        submitted --> draft: reject
        approved --> sent: mark sent
        sent --> partially_received: goods receipt
        partially_received --> received: rest received
        sent --> received: all received
        draft --> cancelled
        approved --> cancelled
        sent --> cancelled: nothing received yet
    }
    state "Stock adjustment / opening stock" as ADJ {
        [*] --> a_draft
        a_draft --> a_submitted: submit
        a_submitted --> a_approved: approve (not the requester)
        a_submitted --> a_rejected: reject
        a_approved --> a_posted: post (stock moves)
        a_draft --> a_cancelled
        a_submitted --> a_cancelled
    }
```

### Delivery note, project, BAST, ticket

```mermaid
stateDiagram-v2
    state "Delivery note" as DN {
        [*] --> prepared
        prepared --> shipped: ship (stock out)
        shipped --> delivered: receiver recorded
        prepared --> cancelled: quantities back to the order
    }
    state "Project" as PRJ {
        [*] --> active: from a deal
        active --> closed: testing + training + BAST evidence (stage: warranty)
        active --> p_cancelled: reason — the deal is free again
    }
    state "BAST" as B {
        [*] --> issued: numbered on creation
        issued --> b_cancelled: while the project is active
    }
    state "Service ticket" as T {
        [*] --> new: warranty checked and stored
        new --> in_progress: start
        new --> resolved
        in_progress --> resolved: resolution + cost
        resolved --> in_progress: reopen
        resolved --> t_closed: customer's confirmation
    }
```

### Serial unit (inventory)

```mermaid
stateDiagram-v2
    [*] --> in_stock: goods receipt (serial per unit)
    in_stock --> sold: delivery note shipped
    in_stock --> borrowed: borrowing (M06)
    borrowed --> in_stock: returned
    in_stock --> lost
    borrowed --> lost
    sold --> [*]
```

## 6. Modules and contracts (component)

Cross-module calls go through exported contracts only (AGENTS.md); no
module reads another module's tables.

```mermaid
flowchart TB
    CRM[crm — customers, leads]
    SALES[sales — SPH, orders, delivery notes]
    FIN[finance — invoices, receipts]
    PROC[procurement — suppliers, PO, goods receipts]
    INV[inventory — items, warehouses, stock ledger, serial units, adjustments]
    PRJ[projects — projects, tasks, evidence, costs, BAST]
    AS[aftersales — warranty certificates, service tickets]
    ORG[organization - internal organizations, settings]
    COMPANY[company - profile, contacts, bank accounts, settings]
    CODE[code_number - numbering series]
    DOC[document - issued document registry]
    SALES -->|CustomerService| CRM
    SALES -->|ItemService, StockService| INV
    FIN -->|SalesBillingService| SALES
    SALES -->|InvoiceLookupService| FIN
    PROC -->|StockService, ItemService, WarehouseService| INV
    PRJ -->|SalesFulfilmentService| SALES
    SALES -->|ProjectLookupService| PRJ
    AS -->|HandoverService, ProjectLookupService| PRJ
    AS -->|SalesFulfilmentService| SALES
    AS -->|CustomerService| CRM
    SALES & FIN & PROC & PRJ & AS -->|CodeNumberService.next| CODE
    SALES & FIN & PROC & PRJ & AS -->|CompanyService.getProfile| COMPANY
    CODE -->|CompanyService.getProfile| COMPANY
    SALES & FIN & PROC & PRJ & AS -->|DocumentService.issue| DOC
```

## 7. Cost (HPP) in stock

```mermaid
flowchart LR
    R[Receipt: qty × ex-VAT price] -->|value += qty × cost| B[(Balance: qty, value)]
    O[Opening stock / increase: qty × entered cost, else average] --> B
    B -->|average = value ÷ qty| A[Average cost]
    A -->|qty × average, the last unit takes the remaining value| X[Issue: delivery note, decrease]
    X --> B
```
