/* =====================================================
   AL JEFOON TENTS
   PAYROLL SYSTEM
   SCRIPT.JS
   VERSION 2.8 (WITH LOAN-ONLY PRINTING)
===================================================== */

/* =====================================================
   STORAGE & APPLICATION STATE
===================================================== */

const STORAGE_KEY = "alJefoonPayrollV1";
const DARK_MODE_KEY = "alJefoonPayrollDarkMode";

let state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") || {
    employees: [],
    transactions: [],
    leaves: []
};

state.employees = Array.isArray(state.employees) ? state.employees : [];
state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
state.leaves = Array.isArray(state.leaves) ? state.leaves : [];

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/* =====================================================
   HELPERS
===================================================== */

const $ = id => document.getElementById(id);

function money(value) {
    return `AED ${Number(value || 0).toLocaleString("en-AE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
}

function positiveBalance(value) {
    const amount = Number(value || 0);
    return amount > 0.009 ? amount : 0;
}

function pendingMoney(value) {
    const amount = positiveBalance(value);
    return amount > 0 ? money(amount) : "-";
}

function monthKey(date) {
    if (!date) return "";
    const d = new Date(String(date).length === 10 ? `${date}T00:00:00` : date);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatReportMonth(month) {
    if (!month) return "";
    const parts = String(month).split("-").map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return "";
    const date = new Date(parts[0], parts[1] - 1, 1);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleString("en-AE", { month: "long", year: "numeric" });
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };
        return entities[character];
    });
}

function getEmployee(id) {
    return state.employees.find(employee => employee.id === id);
}

function employeeName(id) {
    const employee = getEmployee(id);
    return employee ? employee.name : "Unknown Employee";
}

function generateID(prefix) {
    return (
        prefix +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 7)
    ).toUpperCase();
}

function getNextEmployeeID() {
    let highestNumber = 2;
    state.employees.forEach(employee => {
        const match = String(employee.id || "").match(/^EMP(\d+)$/i);
        if (match) {
            const number = parseInt(match[1], 10);
            if (number > highestNumber) {
                highestNumber = number;
            }
        }
    });
    return "EMP" + String(highestNumber + 1).padStart(3, "0");
}

/* =====================================================
   CALCULATION LOGIC
===================================================== */

function getMonthlySalaryPaid(employee, month) {
    return state.transactions
        .filter(t => t.employeeId === employee.id && t.type === "salary" && monthKey(t.date) === month)
        .reduce((total, t) => total + Number(t.amount || 0), 0);
}

function getSalaryCalculationStartDate(employee, month) {
    if (!employee) return `${month}-01`;
    const salaryTransactions = state.transactions
        .filter(t => t.employeeId === employee.id && t.type === "salary" && monthKey(t.date) === month && t.salaryStartDate)
        .sort((a, b) => new Date(a.salaryStartDate + "T00:00:00") - new Date(b.salaryStartDate + "T00:00:00"));

    if (salaryTransactions.length) {
        const date = salaryTransactions[0].salaryStartDate;
        if (monthKey(date) === month) return date;
    }
    return `${month}-01`;
}

function getSalaryStartDay(employee, month, daysInMonth) {
    const startDate = getSalaryCalculationStartDate(employee, month);
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(startDate + "T00:00:00");

    if (isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== monthNumber - 1) {
        return 1;
    }
    return Math.min(Math.max(date.getDate(), 1), daysInMonth);
}

function isEmployeeOnLeave(employee, month) {
    if (!employee) return false;
    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const monthStart = new Date(year, monthNumber - 1, 1);
    const monthEnd = new Date(year, monthNumber - 1, daysInMonth);

    return state.leaves.some(leave => {
        if (leave.employeeId !== employee.id) return false;
        if (!leave.startDate && !leave.endDate) return true;

        if (leave.startDate && !leave.endDate) {
            const start = new Date(leave.startDate + "T00:00:00");
            return start <= monthStart;
        }
        if (!leave.startDate && leave.endDate) {
            const end = new Date(leave.endDate + "T00:00:00");
            return end >= monthEnd;
        }

        const leaveStart = new Date(leave.startDate + "T00:00:00");
        const leaveEnd = new Date(leave.endDate + "T00:00:00");
        return leaveStart <= monthStart && leaveEnd >= monthEnd;
    });
}

function getLeaveDaysForMonth(employee, month, daysInMonth, salaryStartDay = 1) {
    const [year, monthNumber] = month.split("-").map(Number);
    const monthStart = new Date(year, monthNumber - 1, 1);
    const monthEnd = new Date(year, monthNumber - 1, daysInMonth);
    const salaryStart = new Date(year, monthNumber - 1, salaryStartDay);
    let leaveDays = 0;

    state.leaves
        .filter(leave => leave.employeeId === employee.id)
        .forEach(leave => {
            if (!leave.startDate && !leave.endDate) {
                leaveDays += Number(leave.days || 0);
                return;
            }

            if (leave.startDate && !leave.endDate) {
                const leaveStart = new Date(leave.startDate + "T00:00:00");
                const actualStart = leaveStart > salaryStart ? leaveStart : salaryStart;
                if (actualStart > monthEnd) return;

                if (Number(leave.days || 0) > 0) {
                    leaveDays += Number(leave.days);
                } else {
                    const difference = monthEnd.getTime() - actualStart.getTime();
                    leaveDays += Math.floor(difference / (1000 * 60 * 60 * 24)) + 1;
                }
                return;
            }

            if (!leave.startDate && leave.endDate) {
                const leaveEnd = new Date(leave.endDate + "T00:00:00");
                if (leaveEnd < salaryStart) return;

                if (Number(leave.days || 0) > 0) {
                    leaveDays += Number(leave.days);
                } else {
                    const actualEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;
                    const difference = actualEnd.getTime() - salaryStart.getTime();
                    const actualDays = Math.floor(difference / (1000 * 60 * 60 * 24)) + 1;
                    leaveDays += Math.max(0, actualDays);
                }
                return;
            }

            const leaveStart = new Date(leave.startDate + "T00:00:00");
            const leaveEnd = new Date(leave.endDate + "T00:00:00");
            const actualStart = [leaveStart, salaryStart, monthStart].reduce((latest, date) => date > latest ? date : latest);
            const actualEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;

            if (actualStart > actualEnd) return;

            if (Number(leave.days || 0) > 0) {
                leaveDays += Number(leave.days);
            } else {
                const difference = actualEnd.getTime() - actualStart.getTime();
                leaveDays += Math.floor(difference / (1000 * 60 * 60 * 24)) + 1;
            }
        });

    return Math.min(
        Math.max(leaveDays, 0),
        Math.max(0, daysInMonth - salaryStartDay + 1)
    );
}

function getMonthlyTransactionTotal(employee, month, type) {
    return state.transactions
        .filter(t => t.employeeId === employee.id && t.type === type && monthKey(t.date) === month)
        .reduce((total, t) => total + Number(t.amount || 0), 0);
}

function payrollFor(employee, month) {
    const basicSalary = Number(employee.salary || 0);
    const foodAllowance = Number(employee.food || 0);
    const [year, monthNumber] = month.split("-").map(Number);
    const daysInMonth = new Date(year, monthNumber, 0).getDate();

    const salaryStartDay = getSalaryStartDay(employee, month, daysInMonth);
    const salaryPeriodDays = Math.max(0, daysInMonth - salaryStartDay + 1);
    const employeeOnFullLeave = isEmployeeOnLeave(employee, month);

    if (employeeOnFullLeave) {
        return {
            salary: basicSalary,
            food: 0,
            salaryDue: 0,
            salaryPaid: 0,
            pending: 0,
            status: "ON LEAVE",
            advances: getMonthlyTransactionTotal(employee, month, "advance"),
            loanRepayments: getMonthlyTransactionTotal(employee, month, "loan_repayment"),
            adjustments: getMonthlyTransactionTotal(employee, month, "adjustment"),
            leaveDays: daysInMonth,
            payableDays: 0,
            salaryStartDate: `${month}-${String(salaryStartDay).padStart(2, "0")}`,
            salaryStartDay: salaryStartDay,
            salaryPeriodDays: 0
        };
    }

    const leaveDays = getLeaveDaysForMonth(employee, month, daysInMonth, salaryStartDay);
    const payableDays = Math.max(0, salaryPeriodDays - leaveDays);
    const dailySalary = daysInMonth > 0 ? basicSalary / daysInMonth : 0;
    const salaryDue = Math.max(0, dailySalary * payableDays);
    const salaryPaidRaw = getMonthlySalaryPaid(employee, month);
    const salaryPaid = Math.min(Math.max(0, salaryPaidRaw), salaryDue);
    const pendingSalary = positiveBalance(Math.max(0, salaryDue - salaryPaid));

    let status = "PENDING";
    if (salaryDue <= 0.009 || salaryPaid >= salaryDue - 0.009) {
        status = "FULLY PAID";
    } else if (salaryPaid > 0) {
        status = "PARTIALLY PAID";
    }

    return {
        salary: basicSalary,
        food: foodAllowance,
        salaryDue: salaryDue,
        salaryPaid: salaryPaid,
        pending: pendingSalary,
        status: status,
        advances: getMonthlyTransactionTotal(employee, month, "advance"),
        loanRepayments: getMonthlyTransactionTotal(employee, month, "loan_repayment"),
        adjustments: getMonthlyTransactionTotal(employee, month, "adjustment"),
        leaveDays: leaveDays,
        payableDays: payableDays,
        salaryStartDay: salaryStartDay,
        salaryPeriodDays: salaryPeriodDays,
        salaryStartDate: `${month}-${String(salaryStartDay).padStart(2, "0")}`
    };
}

/* =====================================================
   PREVIOUS MONTH PENDING SALARY
===================================================== */

function getPreviousPendingSalary(employee, selectedMonth) {
    const selected = selectedMonth.split("-").map(Number);
    if (selected.length !== 2) return 0;

    const selectedDate = new Date(selected[0], selected[1] - 1, 1);
    let totalPending = 0;
    const months = new Set();

    state.transactions.forEach(transaction => {
        if (transaction.employeeId !== employee.id || transaction.type !== "salary") return;
        
        const key = monthKey(transaction.date);
        if (!key) return;

        const parts = key.split("-").map(Number);
        const transactionDate = new Date(parts[0], parts[1] - 1, 1);

        if (transactionDate < selectedDate) {
            months.add(key);
        }

        if (transaction.salaryStartDate) {
            const startKey = monthKey(transaction.salaryStartDate);
            if (startKey) {
                const startParts = startKey.split("-").map(Number);
                const startDate = new Date(startParts[0], startParts[1] - 1, 1);
                if (startDate < selectedDate) {
                    months.add(startKey);
                }
            }
        }
    });

    state.leaves.forEach(leave => {
        if (leave.employeeId !== employee.id || !leave.startDate) return;
        const key = monthKey(leave.startDate);
        if (!key) return;

        const parts = key.split("-").map(Number);
        const leaveDate = new Date(parts[0], parts[1] - 1, 1);

        if (leaveDate < selectedDate) {
            months.add(key);
        }
    });

    if (months.size === 0) return 0;

    let earliestDate = null;
    months.forEach(key => {
        const parts = key.split("-").map(Number);
        const date = new Date(parts[0], parts[1] - 1, 1);
        if (!earliestDate || date < earliestDate) {
            earliestDate = date;
        }
    });

    if (!earliestDate) return 0;

    let checkDate = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);

    while (checkDate < selectedDate) {
        const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}`;
        const payroll = payrollFor(employee, key);

        if (payroll.status !== "ON LEAVE") {
            totalPending += positiveBalance(payroll.pending);
        }

        checkDate.setMonth(checkDate.getMonth() + 1);
    }

    return positiveBalance(totalPending);
}

/* =====================================================
   LOAN CALCULATION LOGIC
===================================================== */

function getEmployeeLoanSummary(employeeId) {
    const advances = state.transactions
        .filter(t => t.employeeId === employeeId && t.type === "advance")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const repayments = state.transactions
        .filter(t => t.employeeId === employeeId && t.type === "loan_repayment")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    const balance = advances - repayments;
    return {
        totalAdvances: advances,
        totalRepayments: repayments,
        balance: balance > 0 ? balance : 0
    };
}

/* =====================================================
   PRINTING LOGIC (GENERAL & LOAN-ONLY)
===================================================== */

/**
 * Triggers printing of ONLY loan transactions / reports.
 * Adds a temporary CSS rule so non-loan elements are hidden during standard printing.
 */
function printLoansOnly() {
    // 1. Inject or verify print styles for loan isolation
    let styleTag = $("loan-print-style");
    if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "loan-print-style";
        document.head.appendChild(styleTag);
    }

    styleTag.textContent = `
        @media print {
            body * {
                visibility: hidden !important;
            }
            .loan-report-container, .loan-report-container * {
                visibility: visible !important;
            }
            .loan-report-container {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
            }
        }
    `;

    // 2. Mark body for single-mode print tracking
    document.body.classList.add("printing-loans-only");

    // 3. Trigger native print window
    window.print();

    // 4. Cleanup after print popup handles user action
    document.body.classList.remove("printing-loans-only");
}

/**
 * Triggers standard system print (full payroll report).
 */
function printFullReport() {
    const styleTag = $("loan-print-style");
    if (styleTag) {
        styleTag.textContent = ""; // Clear restrictive loan print rules
    }
    window.print();
}

/* =====================================================
   REPORT RENDERING
===================================================== */

function renderLoansReport(targetContainerId = "reportOutput") {
    const container = $(targetContainerId);
    if (!container) return;

    let totalCompanyLoans = 0;
    let totalCompanyRepayments = 0;
    let totalOutstanding = 0;

    const loanRows = state.employees.map(employee => {
        const summary = getEmployeeLoanSummary(employee.id);
        if (summary.totalAdvances === 0 && summary.totalRepayments === 0) return "";

        totalCompanyLoans += summary.totalAdvances;
        totalCompanyRepayments += summary.totalRepayments;
        totalOutstanding += summary.balance;

        return `
            <tr>
                <td>${escapeHTML(employee.id)}</td>
                <td>${escapeHTML(employee.name)}</td>
                <td>${money(summary.totalAdvances)}</td>
                <td>${money(summary.totalRepayments)}</td>
                <td><strong>${money(summary.balance)}</strong></td>
            </tr>
        `;
    }).join("");

    container.innerHTML = `
        <div class="loan-report-container">
            <div style="display:flex; justify-between; align-items:center; margin-bottom: 20px;">
                <div>
                    <h2>AL JEFOON TENTS</h2>
                    <h3>Employee Loans & Advances Report</h3>
                    <p>Generated on: ${new Date().toLocaleDateString("en-AE")}</p>
                </div>
                <button onclick="printLoansOnly()" class="btn-print" style="padding: 8px 16px; cursor: pointer;">
                    Print Loans Only
                </button>
            </div>

            <table border="1" cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="background-color: #f4f4f4;">
                        <th>Employee ID</th>
                        <th>Name</th>
                        <th>Total Advances</th>
                        <th>Total Repaid</th>
                        <th>Outstanding Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${loanRows || '<tr><td colspan="5" style="text-align:center;">No loan history recorded.</td></tr>'}
                </tbody>
                <tfoot>
                    <tr style="background-color: #e9e9e9; font-weight: bold;">
                        <td colspan="2">TOTALS</td>
                        <td>${money(totalCompanyLoans)}</td>
                        <td>${money(totalCompanyRepayments)}</td>
                        <td>${money(totalOutstanding)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
}
