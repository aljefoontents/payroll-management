/* =====================================================
   STATE MANAGEMENT & CONSTANTS
===================================================== */

const STORAGE_KEY = "alJefoonPayrollV1";
const DARK_MODE_KEY = "alJefoonPayrollDarkMode";

let state = {
    employees: [],
    transactions: [],
    leaves: []
};

function loadState() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        try {
            state = JSON.parse(data);
        } catch (e) {
            console.error("Failed to parse state from localStorage:", e);
        }
    }
}

function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

loadState();


/* =====================================================
   HELPER UTILITIES
===================================================== */

function $(id) {
    return document.getElementById(id);
}

function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function money(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " AED";
}

function currentMonth() {
    const now = new Date();
    const yr = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, "0");
    return `${yr}-${mo}`;
}

function getDaysInMonth(monthStr) {
    if (!monthStr) return 30;
    const parts = monthStr.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    return new Date(year, month, 0).getDate();
}

function generateID(prefix = "ID") {
    return prefix + "_" + Math.random().toString(36).substr(2, 7).toUpperCase();
}

function getNextEmployeeID() {
    if (state.employees.length === 0) return "EMP001";
    
    const ids = state.employees
        .map(e => parseInt(e.id.replace("EMP", ""), 10))
        .filter(n => !isNaN(n));

    if (ids.length === 0) return "EMP001";

    const next = Math.max(...ids) + 1;
    return "EMP" + String(next).padStart(3, "0");
}

function getEmployee(id) {
    return state.employees.find(e => e.id === id);
}

function employeeName(id) {
    const emp = getEmployee(id);
    return emp ? emp.name : id;
}


/* =====================================================
   LEAVE CALCULATIONS
===================================================== */

function getLeaveDaysForMonth(employeeId, monthStr) {
    let totalLeaveDays = 0;

    state.leaves
        .filter(leave => leave.employeeId === employeeId)
        .forEach(leave => {
            if (!leave.startDate) return;

            const leaveMonth = leave.startDate.substring(0, 7);
            if (leaveMonth === monthStr) {
                totalLeaveDays += parseFloat(leave.days) || 0;
            }
        });

    return totalLeaveDays;
}

function getEmployeesOnLeave(monthStr) {
    const employeeIDs = new Set();

    state.leaves.forEach(leave => {
        if (!leave.startDate) return;
        const leaveMonth = leave.startDate.substring(0, 7);
        const daysInMo = getDaysInMonth(monthStr);

        if (leaveMonth === monthStr && parseFloat(leave.days) >= daysInMo) {
            employeeIDs.add(leave.employeeId);
        }
    });

    return Array.from(employeeIDs).map(id => getEmployee(id));
}


/* =====================================================
   PAYROLL ENGINE (PRORATED & FOOD OVERRIDE UPDATED)
===================================================== */

function payrollFor(employee, monthStr) {
    const daysInMonth = getDaysInMonth(monthStr);
    const dailySalary = (employee.salary || 0) / daysInMonth;
    const dailyFood = (employee.food || 0) / daysInMonth;

    // Check if employee returned mid-month
    const returnTx = state.transactions.find(t => 
        t.employeeId === employee.id && 
        (t.type === "return_date" || t.salaryStartDate) && 
        ((t.salaryStartDate && t.salaryStartDate.startsWith(monthStr)) || (t.date && t.date.startsWith(monthStr)))
    );

    let activeWorkingDays = daysInMonth;

    if (returnTx) {
        const returnDateStr = returnTx.salaryStartDate || returnTx.date;
        const returnDay = parseInt(returnDateStr.split("-")[2], 10);
        // Returns on 16th of 30-day month = (30 - 16 + 1) = 15 working days
        activeWorkingDays = daysInMonth - returnDay + 1;
    }

    // Deduct leave days
    const loggedLeaveDays = getLeaveDaysForMonth(employee.id, monthStr);
    const payableDays = Math.max(0, activeWorkingDays - loggedLeaveDays);

    // Full Month Leave Check
    if (payableDays === 0 || loggedLeaveDays >= daysInMonth) {
        return {
            salary: employee.salary,
            food: 0,
            payableDays: 0,
            salaryDue: 0,
            salaryPaid: 0,
            pending: 0,
            status: "ON LEAVE"
        };
    }

    // Manual Food Allowance Override Check
    const foodOverrideTx = state.transactions.find(t => 
        t.employeeId === employee.id && 
        t.type === "food_override" && 
        t.date && t.date.startsWith(monthStr)
    );

    // Dynamic Prorated Calculations
    const proratedBasic = Math.round(dailySalary * payableDays);
    const proratedFood = foodOverrideTx 
        ? foodOverrideTx.amount 
        : Math.round(dailyFood * payableDays);

    const salaryDue = proratedBasic + proratedFood;

    // Salary Paid Payments
    const salaryPaid = state.transactions
        .filter(t => t.employeeId === employee.id && t.type === "salary" && t.date.startsWith(monthStr))
        .reduce((sum, t) => sum + t.amount, 0);

    const pending = salaryDue - salaryPaid;

    let status = "UNPAID";
    if (salaryPaid >= salaryDue && salaryDue > 0) {
        status = "PAID";
    } else if (salaryPaid > 0) {
        status = "PARTIAL";
    }

    return {
        salary: employee.salary,
        food: proratedFood,
        payableDays: payableDays,
        salaryDue: salaryDue,
        salaryPaid: salaryPaid,
        pending: pending,
        status: status
    };
}

function getPreviousPendingSalary(employee, currentMonthStr) {
    let totalPreviousPending = 0;

    // Calculate pending for all months prior to current
    const allMonths = Array.from(new Set(
        state.transactions.map(t => t.date ? t.date.substring(0, 7) : null).filter(Boolean)
    )).sort();

    allMonths.forEach(m => {
        if (m < currentMonthStr) {
            const p = payrollFor(employee, m);
            if (p.status !== "ON LEAVE") {
                totalPreviousPending += p.pending;
            }
        }
    });

    return totalPreviousPending;
}


/* =====================================================
   DASHBOARD & STATS
===================================================== */

function renderDashboard() {
    const month = $("dashboardMonth")?.value || currentMonth();

    let totalEmployees = state.employees.length;
    let totalPayrollDue = 0;
    let totalPaid = 0;
    let totalPendingCurrent = 0;
    let totalPendingPrevious = 0;

    state.employees.forEach(employee => {
        const payroll = payrollFor(employee, month);
        const prevPending = getPreviousPendingSalary(employee, month);

        if (payroll.status !== "ON LEAVE") {
            totalPayrollDue += payroll.salaryDue;
            totalPaid += payroll.salaryPaid;
            totalPendingCurrent += payroll.pending;
        }

        totalPendingPrevious += prevPending;
    });

    const employeesOnLeave = getEmployeesOnLeave(month);

    if ($("statTotalEmployees")) $("statTotalEmployees").innerText = totalEmployees;
    if ($("statTotalDue")) $("statTotalDue").innerText = money(totalPayrollDue);
    if ($("statTotalPaid")) $("statTotalPaid").innerText = money(totalPaid);
    if ($("statCurrentPending")) $("statCurrentPending").innerText = money(totalPendingCurrent);
    if ($("statPreviousPending")) $("statPreviousPending").innerText = money(totalPendingPrevious);
    if ($("statOnLeave")) $("statOnLeave").innerText = employeesOnLeave.length;

    renderDashboardTable(month);
}

function renderDashboardTable(month) {
    const tbody = $("dashboardTableBody");
    if (!tbody) return;

    if (state.employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;">No employees found.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.employees.map(employee => {
        const payroll = payrollFor(employee, month);
        const prevPending = getPreviousPendingSalary(employee, month);

        return `
            <tr>
                <td>${escapeHTML(employee.id)}</td>
                <td>${escapeHTML(employee.name)}</td>
                <td>${money(payroll.salary)}</td>
                <td>${money(payroll.food)}</td>
                <td>${money(payroll.salaryDue)}</td>
                <td>${money(payroll.salaryPaid)}</td>
                <td>${money(payroll.pending + prevPending)}</td>
                <td><span class="status-badge status-${payroll.status.toLowerCase().replace(/\s+/g, '-')}">${payroll.status}</span></td>
            </tr>
        `;
    }).join("");
}


/* =====================================================
   EMPLOYEE MANAGEMENT
===================================================== */

function renderEmployees() {
    const tbody = $("employeeTableBody");
    if (!tbody) return;

    if (state.employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No employee records available.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.employees.map(employee => `
        <tr>
            <td>${escapeHTML(employee.id)}</td>
            <td>${escapeHTML(employee.name)}</td>
            <td>${escapeHTML(employee.designation || "-")}</td>
            <td>${money(employee.salary)}</td>
            <td>${money(employee.food)}</td>
            <td>
                <button onclick="editEmployee('${employee.id}')">Edit</button>
                <button onclick="deleteEmployee('${employee.id}')">Delete</button>
            </td>
        </tr>
    `).join("");
}

function saveEmployee(event) {
    if (event) event.preventDefault();

    const idInput = $("employeeId");
    const nameInput = $("employeeName");
    const designationInput = $("employeeDesignation");
    const salaryInput = $("employeeSalary");
    const foodInput = $("employeeFood");

    const isEdit = Boolean(idInput.value);

    const employeeData = {
        id: isEdit ? idInput.value : getNextEmployeeID(),
        name: nameInput.value.trim(),
        designation: designationInput.value.trim(),
        salary: parseFloat(salaryInput.value) || 0,
        food: parseFloat(foodInput.value) || 0
    };

    if (!employeeData.name) {
        alert("Please enter a valid employee name.");
        return;
    }

    if (isEdit) {
        const index = state.employees.findIndex(emp => emp.id === employeeData.id);
        if (index !== -1) state.employees[index] = employeeData;
    } else {
        state.employees.push(employeeData);
    }

    save();
    resetEmployeeForm();
    populateEmployeeDropdowns();
    renderEmployees();
    renderDashboard();
}

function editEmployee(id) {
    const employee = getEmployee(id);
    if (!employee) return;

    $("employeeId").value = employee.id;
    $("employeeName").value = employee.name;
    $("employeeDesignation").value = employee.designation || "";
    $("employeeSalary").value = employee.salary || 0;
    $("employeeFood").value = employee.food || 0;
}

function deleteEmployee(id) {
    if (!confirm(`Are you sure you want to delete employee ${id}?`)) return;

    state.employees = state.employees.filter(emp => emp.id !== id);
    state.transactions = state.transactions.filter(t => t.employeeId !== id);
    state.leaves = state.leaves.filter(l => l.employeeId !== id);

    save();
    populateEmployeeDropdowns();
    renderEmployees();
    renderDashboard();
}

function resetEmployeeForm() {
    if ($("employeeForm")) $("employeeForm").reset();
    if ($("employeeId")) $("employeeId").value = "";
}


/* =====================================================
   LEAVE MANAGEMENT
===================================================== */

function renderLeaves() {
    const tbody = $("leaveTableBody");
    if (!tbody) return;

    if (state.leaves.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">No leave records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.leaves.map(leave => `
        <tr>
            <td>${escapeHTML(leave.id)}</td>
            <td>${escapeHTML(employeeName(leave.employeeId))}</td>
            <td>${leave.startDate || "N/A"}</td>
            <td>${leave.endDate || "N/A"}</td>
            <td>${leave.days || "N/A"}</td>
            <td>
                <button onclick="editLeave('${leave.id}')">Edit</button>
                <button onclick="deleteLeave('${leave.id}')">Delete</button>
            </td>
        </tr>
    `).join("");
}

function saveLeave(event) {
    if (event) event.preventDefault();

    const idInput = $("leaveId");
    const empInput = $("leaveEmployeeId");
    const startInput = $("leaveStartDate");
    const endInput = $("leaveEndDate");
    const daysInput = $("leaveDays");

    const isEdit = Boolean(idInput.value);

    const leaveData = {
        id: isEdit ? idInput.value : generateID("LV"),
        employeeId: empInput.value,
        startDate: startInput.value || "",
        endDate: endInput.value || "",
        days: parseFloat(daysInput.value) || 0
    };

    if (!leaveData.employeeId) {
        alert("Please select an employee.");
        return;
    }

    if (isEdit) {
        const index = state.leaves.findIndex(l => l.id === leaveData.id);
        if (index !== -1) state.leaves[index] = leaveData;
    } else {
        state.leaves.push(leaveData);
    }

    save();
    resetLeaveForm();
    renderLeaves();
    renderDashboard();
}

function editLeave(id) {
    const leave = state.leaves.find(l => l.id === id);
    if (!leave) return;

    $("leaveId").value = leave.id;
    $("leaveEmployeeId").value = leave.employeeId;
    $("leaveStartDate").value = leave.startDate || "";
    $("leaveEndDate").value = leave.endDate || "";
    $("leaveDays").value = leave.days || 0;
}

function deleteLeave(id) {
    if (!confirm("Delete this leave record?")) return;

    state.leaves = state.leaves.filter(l => l.id !== id);

    save();
    renderLeaves();
    renderDashboard();
}

function resetLeaveForm() {
    if ($("leaveForm")) $("leaveForm").reset();
    if ($("leaveId")) $("leaveId").value = "";
}


/* =====================================================
   TRANSACTIONS (SALARY / ADVANCE / LOAN / RETURN / FOOD)
===================================================== */

function toggleTransactionFields() {
    const typeSelect = $("transactionType");
    if (!typeSelect) return;

    const type = typeSelect.value;
    const amountContainer = $("amountContainer");
    const amountLabel = $("amountLabel");
    const dateLabel = $("dateLabel");

    if (type === "return_date") {
        if (amountContainer) amountContainer.style.display = "none";
        if (dateLabel) dateLabel.innerText = "Return Date";
    } else if (type === "food_override") {
        if (amountContainer) amountContainer.style.display = "block";
        if (amountLabel) amountLabel.innerText = "Custom Food Allowance Amount (AED)";
        if (dateLabel) dateLabel.innerText = "Effective Month Date";
    } else {
        if (amountContainer) amountContainer.style.display = "block";
        if (amountLabel) amountLabel.innerText = "Amount (AED)";
        if (dateLabel) dateLabel.innerText = "Date";
    }
}

function renderTransactions() {
    const tbody = $("transactionTableBody");
    if (!tbody) return;

    if (state.transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No transaction records found.</td></tr>`;
        return;
    }

    tbody.innerHTML = state.transactions.map(t => `
        <tr>
            <td>${escapeHTML(t.id)}</td>
            <td>${escapeHTML(employeeName(t.employeeId))}</td>
            <td>${t.type.toUpperCase().replace("_", " ")}</td>
            <td>${t.type === "return_date" ? "N/A" : money(t.amount)}</td>
            <td>${t.date || "-"}</td>
            <td>${t.salaryStartDate || "-"}</td>
            <td>
                <button onclick="editTransaction('${t.id}')">Edit</button>
                <button onclick="deleteTransaction('${t.id}')">Delete</button>
            </td>
        </tr>
    `).join("");
}

function saveTransaction(event) {
    if (event) event.preventDefault();

    const idInput = $("transactionId");
    const empInput = $("transactionEmployeeId");
    const typeInput = $("transactionType");
    const amountInput = $("transactionAmount");
    const dateInput = $("transactionDate");

    const isEdit = Boolean(idInput.value);
    const type = typeInput.value;
    const amount = parseFloat(amountInput.value) || 0;

    if (!empInput.value) {
        alert("Please select an employee.");
        return;
    }

    if (type !== "return_date" && amount <= 0) {
        alert("Please enter a valid amount.");
        return;
    }

    const transactionData = {
        id: isEdit ? idInput.value : generateID("TX"),
        employeeId: empInput.value,
        type: type,
        amount: type === "return_date" ? 0 : amount,
        date: dateInput.value || currentMonth() + "-01",
        salaryStartDate: type === "return_date" ? dateInput.value : ""
    };

    if (isEdit) {
        const index = state.transactions.findIndex(t => t.id === transactionData.id);
        if (index !== -1) state.transactions[index] = transactionData;
    } else {
        state.transactions.push(transactionData);
    }

    save();
    resetTransactionForm();
    renderTransactions();
    renderDashboard();
}

function editTransaction(id) {
    const t = state.transactions.find(item => item.id === id);
    if (!t) return;

    $("transactionId").value = t.id;
    $("transactionEmployeeId").value = t.employeeId;
    $("transactionType").value = t.type;
    $("transactionAmount").value = t.amount;
    $("transactionDate").value = t.date;

    toggleTransactionFields();
}

function deleteTransaction(id) {
    if (!confirm("Delete this transaction?")) return;

    state.transactions = state.transactions.filter(t => t.id !== id);

    save();
    renderTransactions();
    renderDashboard();
}

function resetTransactionForm() {
    if ($("transactionForm")) $("transactionForm").reset();
    if ($("transactionId")) $("transactionId").value = "";
    toggleTransactionFields();
}


/* =====================================================
   DARK MODE TOGGLE
===================================================== */

function initDarkMode() {
    const isDark = localStorage.getItem(DARK_MODE_KEY) === "true";
    if (isDark) document.body.classList.add("dark-mode");

    const toggleBtn = $("darkModeToggle");
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            document.body.classList.toggle("dark-mode");
            const current = document.body.classList.contains("dark-mode");
            localStorage.setItem(DARK_MODE_KEY, current);
        };
    }
}


/* =====================================================
   POPULATE DROPDOWNS
===================================================== */

function populateEmployeeDropdowns() {
    const selects = [
        $("leaveEmployeeId"),
        $("transactionEmployeeId"),
        $("reportEmployeeId")
    ];

    selects.forEach(select => {
        if (!select) return;
        const val = select.value;

        select.innerHTML = `<option value="">Select Employee</option>` +
            state.employees.map(e => `
                <option value="${e.id}">${escapeHTML(e.name)} (${e.id})</option>
            `).join("");

        select.value = val;
    });
}


/* =====================================================
   INITIALIZATION
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
    initDarkMode();

    if ($("dashboardMonth")) {
        $("dashboardMonth").value = currentMonth();
        $("dashboardMonth").onchange = () => renderDashboard();
    }

    populateEmployeeDropdowns();
    toggleTransactionFields();

    renderDashboard();
    renderEmployees();
    renderLeaves();
    renderTransactions();
});
