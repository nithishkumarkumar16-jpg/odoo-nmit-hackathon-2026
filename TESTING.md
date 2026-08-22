# Integration Testing Suite

Dayflow features an automated integration testing suite written in TypeScript. It bypasses network sockets and runs programmatic queries directly on a clean, in-memory PostgreSQL instance (`@electric-sql/pglite` with no path parameter) to ensure database mutations, transactions, triggers, and mathematical invariants are 100% correct.

## 1. Running the Integration Tests

To execute the test suite, navigate to the `server/` directory and run:

```bash
cd server
npm run test
```

## 2. Test Coverage Details

The test suite programmatically tests the following critical business logic:

1. **Company Onboarding**:
   - Assures company registration successfully inserts a record and returns a valid UUID.
   - Verifies the administrator Login ID prefix algorithm (e.g. `NOAD20260001` or `NOMAAD20260001` depending on initials).

2. **Employee Creation & Atomic Counters**:
   - Assures creating a new employee atomically increments the serial number per company per year.
   - Assures the serial resets to `0001` for a new calendar year.

3. **Attendance & Work Hours**:
   - Verifies check-in logs entries.
   - Verifies work hours are correctly calculated as the difference between check-in and check-out.
   - Verifies extra hours are calculated correctly at query-time as `GREATEST(work_hours - standard_shift_hours, 0)`.

4. **Leaves & Allocation Balances**:
   - Assures creating leave requests logs status and tracks half-days correctly.
   - Assures approving a request decrements the employee's remaining leave balance.
   - Assures the balance validation stops a request if the duration exceeds the remaining allocation.

5. **Salary Component sum validation**:
   - Assures the sum of all computed salary component values dynamically matches the `month_wage` constraint.
   - Verifies the **Fixed Allowance** component absorbs the remainder (`wage - sum(other components)`).

6. **Payslip Calculations**:
   - Verifies the pro-rated gross pay formula: `month_wage * (payable_days / total_days_in_month)`.
   - Assures net pay deductions for Provident Fund (PF) and Professional Tax are calculated correctly.
