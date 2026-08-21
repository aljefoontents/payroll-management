/* =====================================================
   AL JEFOON TENTS
   PAYROLL SYSTEM
   SCRIPT.JS
===================================================== */

const STORAGE_KEY = "alJefoonPayrollV1";
const DARK_MODE_KEY = "alJefoonPayrollDarkMode";


/* =====================================================
   DEFAULT EMPLOYEES
===================================================== */

const DEFAULT_EMPLOYEES = [];


/* =====================================================
   APPLICATION STATE
===================================================== */

let state =
    JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "null"
    ) || {
        employees: DEFAULT_EMPLOYEES,
        transactions: [],
        leaves: []
    };


/* =====================================================
   HELPERS
===================================================== */

const $ = id =>
    document.getElementById(id);


function save() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );

}


function money(value) {

    return `AED ${Number(value || 0).toLocaleString(
        "en-AE",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )}`;

}


function monthKey(date) {

    const d = new Date(date);

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, "0")}`;

}


function currentMonth() {

    const d = new Date();

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, "0")}`;

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(/[&<>"']/g, character => {

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

    return state.employees.find(
        employee =>
            employee.id === id
    );

}


function employeeName(id) {

    const employee =
        getEmployee(id);

    return employee
        ? employee.name
        : "Unknown Employee";

}


function generateID(prefix) {

    return (
        prefix +
        Date.now().toString(36) +
        Math.random()
            .toString(36)
            .substring(2, 7)
    ).toUpperCase();

}


/* =====================================================
   AUTO EMPLOYEE ID
   STARTS AT EMP003
===================================================== */

function getNextEmployeeID() {

    let highestNumber = 2;


    state.employees.forEach(employee => {

        const match =
            String(employee.id || "")
                .match(/^EMP(\d+)$/i);


        if (match) {

            const number =
                parseInt(
                    match[1],
                    10
                );


            if (
                number > highestNumber
            ) {

                highestNumber =
                    number;

            }

        }

    });


    return (
        "EMP" +
        String(
            highestNumber + 1
        ).padStart(3, "0")
    );

}


/* =====================================================
   PAYROLL CALCULATION
===================================================== */

function payrollFor(
    employee,
    month
) {

    const transactions =
        state.transactions.filter(
            transaction =>

                transaction.employeeId ===
                employee.id &&

                monthKey(
                    transaction.date
                ) === month
        );


    const salaryPaid =
        transactions
            .filter(
                t =>
                    t.type === "salary"
            )
            .reduce(
                (total, t) =>
                    total +
                    Number(
                        t.amount || 0
                    ),
                0
            );


    const advances =
        transactions
            .filter(
                t =>
                    t.type === "advance"
            )
            .reduce(
                (total, t) =>
                    total +
                    Number(
                        t.amount || 0
                    ),
                0
            );


    const loanRepayments =
        transactions
            .filter(
                t =>
                    t.type === "loan_repayment"
            )
            .reduce(
                (total, t) =>
                    total +
                    Number(
                        t.amount || 0
                    ),
                0
            );


    const adjustments =
        transactions
            .filter(
                t =>
                    t.type === "adjustment"
            )
            .reduce(
                (total, t) =>
                    total +
                    Number(
                        t.amount || 0
                    ),
                0
            );


    const earned =
        Number(
            employee.salary || 0
        ) +
        Number(
            employee.food || 0
        );


    const deductions =
        salaryPaid +
        advances +
        loanRepayments +
        adjustments;


    const remaining =
        Math.max(
            0,
            earned -
            deductions
        );


    const leaveDays =
        state.leaves
            .filter(
                leave =>

                    leave.employeeId ===
                    employee.id &&

                    monthKey(
                        leave.startDate
                    ) === month
            )
            .reduce(
                (total, leave) =>
                    total +
                    Number(
                        leave.days || 0
                    ),
                0
            );


    return {

        earned,

        salaryPaid,

        advances,

        loanRepayments,

        adjustments,

        deductions,

        remaining,

        leaveDays

    };

}


/* =====================================================
   OUTSTANDING LOAN
===================================================== */

function outstandingLoan(
    employee
) {

    return state.transactions
        .filter(
            transaction =>
                transaction.employeeId ===
                employee.id
        )
        .reduce(
            (
                total,
                transaction
            ) => {

                if (
                    transaction.type ===
                    "loan"
                ) {

                    return (
                        total +
                        Number(
                            transaction.amount ||
                            0
                        )
                    );

                }


                if (
                    transaction.type ===
                    "loan_repayment"
                ) {

                    return (
                        total -
                        Number(
                            transaction.amount ||
                            0
                        )
                    );

                }


                return total;

            },
            0
        );

}


/* =====================================================
   RENDER ALL
===================================================== */

function renderAll() {

    populateEmployeeSelects();

    renderDashboard();

    renderEmployees();

    renderTransactions();

    renderLeave();

    renderReport();

}


/* =====================================================
   EMPLOYEE SELECTS
===================================================== */

function populateEmployeeSelects() {

    const select =
        $("transactionEmployee");


    if (!select) return;


    const currentValue =
        select.value;


    select.innerHTML =
        `
        <option value="">
            All Employees
        </option>
        ` +

        state.employees
            .map(
                employee =>

                    `
                    <option
                        value="${escapeHTML(
                            employee.id
                        )}"
                    >
                        ${escapeHTML(
                            employee.name
                        )}
                    </option>
                    `
            )
            .join("");


    select.value =
        currentValue;

}


function employeeOptions(
    selected = ""
) {

    return state.employees
        .map(
            employee =>

                `
                <option
                    value="${escapeHTML(
                        employee.id
                    )}"
                    ${
                        employee.id === selected
                            ? "selected"
                            : ""
                    }
                >
                    ${escapeHTML(
                        employee.name
                    )}
                </option>
                `
        )
        .join("");

}


/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {

    const monthInput =
        $("dashboardMonth");


    if (!monthInput) return;


    const month =
        monthInput.value ||
        currentMonth();


    monthInput.value =
        month;


    const payroll =
        state.employees.map(
            employee =>
                payrollFor(
                    employee,
                    month
                )
        );


    const totalPayroll =
        payroll.reduce(
            (total, row) =>
                total +
                row.earned,
            0
        );


    const totalPaid =
        payroll.reduce(
            (total, row) =>
                total +
                row.deductions,
            0
        );


    const totalPending =
        payroll.reduce(
            (total, row) =>
                total +
                row.remaining,
            0
        );


    const totalLoans =
        state.employees.reduce(
            (
                total,
                employee
            ) =>
                total +
                Math.max(
                    0,
                    outstandingLoan(
                        employee
                    )
                ),
            0
        );


    const employeesOnLeave =
        payroll.filter(
            row =>
                row.leaveDays > 0
        ).length;


    if ($("statEmployees"))
        $("statEmployees").textContent =
            state.employees.length;


    if ($("statSalaries"))
        $("statSalaries").textContent =
            money(totalPayroll);


    if ($("statPaid"))
        $("statPaid").textContent =
            money(totalPaid);


    if ($("statPending"))
        $("statPending").textContent =
            money(totalPending);


    if ($("statLoans"))
        $("statLoans").textContent =
            money(totalLoans);


    if ($("statLeave"))
        $("statLeave").textContent =
            employeesOnLeave;


    if (!$("dashboardTable"))
        return;


    $("dashboardTable").innerHTML = `

        <thead>

            <tr>

                <th>Employee</th>

                <th class="num">
                    Salary
                </th>

                <th class="num">
                    Food Allowance
                </th>

                <th class="num">
                    Total
                </th>

                <th class="num">
                    Paid / Deductions
                </th>

                <th class="num">
                    Remaining
                </th>

                <th>
                    Leave
                </th>

            </tr>

        </thead>

        <tbody>

            ${
                state.employees.length

                    ?

                state.employees
                    .map(
                        (
                            employee,
                            index
                        ) => {

                            const row =
                                payroll[index];


                            return `

                                <tr>

                                    <td>
                                        <b>
                                            ${escapeHTML(
                                                employee.id
                                            )}
                                        </b>
                                        -
                                        ${escapeHTML(
                                            employee.name
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            employee.salary
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            employee.food
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            row.earned
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            row.deductions
                                        )}
                                    </td>

                                    <td class="num">
                                        <b>
                                            ${money(
                                                row.remaining
                                            )}
                                        </b>
                                    </td>

                                    <td>
                                        ${
                                            row.leaveDays
                                                ?
                                            `<span class="status leave">
                                                ${row.leaveDays}
                                                day(s)
                                            </span>`
                                                :
                                            "-"
                                        }
                                    </td>

                                </tr>

                            `;

                        }
                    )
                    .join("")

                    :

                `
                    <tr>

                        <td
                            colspan="7"
                            class="empty"
                        >
                            No employees added yet.
                        </td>

                    </tr>
                `
            }

        </tbody>

    `;

}


/* =====================================================
   EMPLOYEES
===================================================== */

function renderEmployees() {

    if (!$("employeesTable"))
        return;


    $("employeesTable").innerHTML = `

        <thead>

            <tr>

                <th>
                    Employee ID
                </th>

                <th>
                    Employee
                </th>

                <th class="num">
                    Salary
                </th>

                <th class="num">
                    Food Allowance
                </th>

                <th class="num">
                    Monthly Total
                </th>

                <th class="num">
                    Loan Outstanding
                </th>

                <th>
                    Actions
                </th>

            </tr>

        </thead>

        <tbody>

            ${
                state.employees.length

                    ?

                state.employees
                    .map(
                        employee => `

                            <tr>

                                <td>
                                    <b>
                                        ${escapeHTML(
                                            employee.id
                                        )}
                                    </b>
                                </td>

                                <td>
                                    ${escapeHTML(
                                        employee.name
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        employee.salary
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        employee.food
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        Number(
                                            employee.salary
                                        ) +
                                        Number(
                                            employee.food
                                        )
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        Math.max(
                                            0,
                                            outstandingLoan(
                                                employee
                                            )
                                        )
                                    )}
                                </td>

                                <td>

                                    <button
                                        class="action-btn"
                                        onclick="editEmployee('${employee.id}')"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        class="action-btn"
                                        onclick="deleteEmployee('${employee.id}')"
                                    >
                                        Delete
                                    </button>

                                </td>

                            </tr>

                        `
                    )
                    .join("")

                    :

                `
                    <tr>

                        <td
                            colspan="7"
                            class="empty"
                        >
                            No employees added yet.
                        </td>

                    </tr>
                `
            }

        </tbody>

    `;

}


/* =====================================================
   TRANSACTIONS
===================================================== */

function renderTransactions() {

    if (!$("transactionsTable"))
        return;


    const month =
        $("transactionMonth")
            ? $("transactionMonth").value
            : "";


    const employeeId =
        $("transactionEmployee")
            ? $("transactionEmployee").value
            : "";


    const type =
        $("transactionType")
            ? $("transactionType").value
            : "";


    let rows =
        [...state.transactions]
            .sort(
                (a, b) =>
                    new Date(b.date) -
                    new Date(a.date)
            );


    if (month) {

        rows =
            rows.filter(
                transaction =>
                    monthKey(
                        transaction.date
                    ) === month
            );

    }


    if (employeeId) {

        rows =
            rows.filter(
                transaction =>
                    transaction.employeeId ===
                    employeeId
            );

    }


    if (type) {

        rows =
            rows.filter(
                transaction =>
                    transaction.type ===
                    type
            );

    }


    const labels = {

        salary:
            "Salary Paid",

        advance:
            "Advance",

        loan:
            "Loan Given",

        loan_repayment:
            "Loan Repayment",

        adjustment:
            "Other Adjustment"

    };


    $("transactionsTable").innerHTML = `

        <thead>

            <tr>

                <th>Date</th>

                <th>Employee</th>

                <th>Type</th>

                <th class="num">
                    Amount
                </th>

                <th>Note</th>

                <th>Actions</th>

            </tr>

        </thead>

        <tbody>

            ${
                rows.length

                    ?

                rows
                    .map(
                        transaction => `

                            <tr>

                                <td>
                                    ${escapeHTML(
                                        transaction.date
                                    )}
                                </td>

                                <td>
                                    <b>
                                        ${escapeHTML(
                                            transaction.employeeId
                                        )}
                                    </b>
                                    -
                                    ${escapeHTML(
                                        employeeName(
                                            transaction.employeeId
                                        )
                                    )}
                                </td>

                                <td>
                                    ${
                                        labels[
                                            transaction.type
                                        ] ||
                                        escapeHTML(
                                            transaction.type
                                        )
                                    }
                                </td>

                                <td class="num">
                                    ${money(
                                        transaction.amount
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        transaction.note
                                    )}
                                </td>

                                <td>

                                    <button
                                        class="action-btn"
                                        onclick="deleteTransaction('${transaction.id}')"
                                    >
                                        Delete
                                    </button>

                                </td>

                            </tr>

                        `
                    )
                    .join("")

                    :

                `
                    <tr>

                        <td
                            colspan="6"
                            class="empty"
                        >
                            No transactions found.
                        </td>

                    </tr>
                `
            }

        </tbody>

    `;

}


/* =====================================================
   LEAVE
===================================================== */

function renderLeave() {

    if (!$("leaveTable"))
        return;


    const rows =
        [...state.leaves]
            .sort(
                (a, b) =>
                    new Date(
                        b.startDate
                    ) -
                    new Date(
                        a.startDate
                    )
            );


    $("leaveTable").innerHTML = `

        <thead>

            <tr>

                <th>
                    Employee
                </th>

                <th>
                    Start Date
                </th>

                <th>
                    End Date
                </th>

                <th>
                    Days
                </th>

                <th>
                    Reason
                </th>

                <th>
                    Actions
                </th>

            </tr>

        </thead>

        <tbody>

            ${
                rows.length

                    ?

                rows
                    .map(
                        leave => `

                            <tr>

                                <td>
                                    <b>
                                        ${escapeHTML(
                                            leave.employeeId
                                        )}
                                    </b>
                                    -
                                    ${escapeHTML(
                                        employeeName(
                                            leave.employeeId
                                        )
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        leave.startDate
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        leave.endDate
                                    )}
                                </td>

                                <td>
                                    ${leave.days}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        leave.reason
                                    )}
                                </td>

                                <td>

                                    <button
                                        class="action-btn"
                                        onclick="deleteLeave('${leave.id}')"
                                    >
                                        Delete
                                    </button>

                                </td>

                            </tr>

                        `
                    )
                    .join("")

                    :

                `
                    <tr>

                        <td
                            colspan="6"
                            class="empty"
                        >
                            No leave records found.
                        </td>

                    </tr>
                `
            }

        </tbody>

    `;

}


/* =====================================================
   MONTHLY REPORT
===================================================== */

function renderReport() {

    const reportMonth =
        $("reportMonth");


    if (!reportMonth)
        return;


    const month =
        reportMonth.value ||
        currentMonth();


    reportMonth.value =
        month;


    const rows =
        state.employees.map(
            employee => ({

                employee,

                payroll:
                    payrollFor(
                        employee,
                        month
                    )

            })
        );


    const totalPayroll =
        rows.reduce(
            (total, row) =>
                total +
                row.payroll.earned,
            0
        );


    const totalPaid =
        rows.reduce(
            (total, row) =>
                total +
                row.payroll.deductions,
            0
        );


    const totalPending =
        rows.reduce(
            (total, row) =>
                total +
                row.payroll.remaining,
            0
        );


    const totalLoans =
        state.employees.reduce(
            (
                total,
                employee
            ) =>
                total +
                Math.max(
                    0,
                    outstandingLoan(
                        employee
                    )
                ),
            0
        );


    if ($("reportSummary")) {

        $("reportSummary").innerHTML = `

            <div class="summary-box">

                <span>
                    Total Payroll
                </span>

                <strong>
                    ${money(
                        totalPayroll
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    Paid / Deductions
                </span>

                <strong>
                    ${money(
                        totalPaid
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    Pending Salaries
                </span>

                <strong>
                    ${money(
                        totalPending
                    )}
                </strong>

            </div>


            <div class="summary-box">

                <span>
                    Outstanding Loans
                </span>

                <strong>
                    ${money(
                        totalLoans
                    )}
                </strong>

            </div>

        `;

    }


    if (!$("reportTable"))
        return;


    $("reportTable").innerHTML = `

        <thead>

            <tr>

                <th>
                    Employee ID
                </th>

                <th>
                    Employee
                </th>

                <th class="num">
                    Salary
                </th>

                <th class="num">
                    Food
                </th>

                <th class="num">
                    Total
                </th>

                <th class="num">
                    Salary Paid
                </th>

                <th class="num">
                    Advances
                </th>

                <th class="num">
                    Loan Repayment
                </th>

                <th class="num">
                    Other
                </th>

                <th class="num">
                    Remaining
                </th>

                <th>
                    Leave
                </th>

            </tr>

        </thead>

        <tbody>

            ${
                rows.length

                    ?

                rows
                    .map(
                        row => `

                            <tr>

                                <td>
                                    <b>
                                        ${escapeHTML(
                                            row.employee.id
                                        )}
                                    </b>
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.employee.name
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.employee.salary
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.employee.food
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.earned
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.salaryPaid
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.advances
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.loanRepayments
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.adjustments
                                    )}
                                </td>

                                <td class="num">

                                    <b>
                                        ${money(
                                            row.payroll.remaining
                                        )}
                                    </b>

                                </td>

                                <td>

                                    ${
                                        row.payroll.leaveDays
                                            ?
                                        row.payroll.leaveDays +
                                        " day(s)"
                                            :
                                        "-"
                                    }

                                </td>

                            </tr>

                        `
                    )
                    .join("")

                    :

                `
                    <tr>

                        <td
                            colspan="11"
                            class="empty"
                        >
                            No employees added yet.
                        </td>

                    </tr>
                `
            }

        </tbody>

    `;

}


/* =====================================================
   MODAL
===================================================== */

function openModal(
    title,
    html,
    submitFunction
) {

    if (!$("modal"))
        return;


    $("modalTitle").textContent =
        title;


    $("modalForm").innerHTML =
        html;


    $("modal").classList.remove(
        "hidden"
    );


    $("modalForm").onsubmit =
        event => {

            event.preventDefault();


            submitFunction(
                new FormData(
                    event.target
                )
            );

        };

}


function closeModal() {

    if ($("modal")) {

        $("modal").classList.add(
            "hidden"
        );

    }

}


if ($("closeModal")) {

    $("closeModal").onclick =
        closeModal;

}


if ($("modal")) {

    $("modal").onclick =
        event => {

            if (
                event.target ===
                $("modal")
            ) {

                closeModal();

            }

        };

}


/* =====================================================
   ADD EMPLOYEE
===================================================== */

function addEmployee() {

    const nextID =
        getNextEmployeeID();


    openModal(

        "Add Employee",

        `

        <div class="form-grid">


            <div class="form-field">

                <label>
                    Employee ID
                </label>

                <input
                    value="${nextID}"
                    disabled
                >

                <input
                    type="hidden"
                    name="id"
                    value="${nextID}"
                >

            </div>


            <div class="form-field">

                <label>
                    Employee Name
                </label>

                <input
                    name="name"
                    required
                    autofocus
                    placeholder="Enter employee name"
                >

            </div>


            <div class="form-field">

                <label>
                    Monthly Salary (AED)
                </label>

                <input
                    name="salary"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                >

            </div>


            <div class="form-field">

                <label>
                    Food Allowance (AED)
                </label>

                <input
                    name="food"
                    type="number"
                    min="0"
                    step="0.01"
                    value="0"
                    required
                >

            </div>


        </div>


        <div class="form-actions">


            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Save Employee
            </button>


        </div>

        `,

        formData => {

            const id =
                formData
                    .get("id")
                    .trim();


            const name =
                formData
                    .get("name")
                    .trim();


            if (!name) {

                alert(
                    "Please enter the employee name."
                );

                return;

            }


            state.employees.push({

                id: id,

                name: name,

                salary:
                    Number(
                        formData.get(
                            "salary"
                        )
                    ),

                food:
                    Number(
                        formData.get(
                            "food"
                        )
                    )

            });


            save();

            closeModal();

            renderAll();

        }

    );

}


/* =====================================================
   EDIT EMPLOYEE
===================================================== */

function editEmployee(id) {

    const employee =
        getEmployee(id);


    if (!employee)
        return;


    openModal(

        "Edit Employee",

        `

        <div class="form-grid">


            <div class="form-field">

                <label>
                    Employee ID
                </label>

                <input
                    value="${escapeHTML(
                        employee.id
                    )}"
                    disabled
                >

            </div>


            <div class="form-field">

                <label>
                    Employee Name
                </label>

                <input
                    name="name"
                    value="${escapeHTML(
                        employee.name
                    )}"
                    required
                >

            </div>


            <div class="form-field">

                <label>
                    Monthly Salary (AED)
                </label>

                <input
                    name="salary"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${employee.salary}"
                    required
                >

            </div>


            <div class="form-field">

                <label>
                    Food Allowance (AED)
                </label>

                <input
                    name="food"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${employee.food}"
                    required
                >

            </div>


        </div>


        <div class="form-actions">


            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Save Changes
            </button>


        </div>

        `,

        formData => {

            employee.name =
                formData
                    .get("name")
                    .trim();


            employee.salary =
                Number(
                    formData.get(
                        "salary"
                    )
                );


            employee.food =
                Number(
                    formData.get(
                        "food"
                    )
                );


            save();

            closeModal();

            renderAll();

        }

    );

}


/* =====================================================
   DELETE EMPLOYEE
===================================================== */

function deleteEmployee(id) {

    const employee =
        getEmployee(id);


    if (!employee)
        return;


    if (
        !confirm(
            `Delete ${employee.name}?\n\n` +
            `All salary, advance, loan and leave ` +
            `records for this employee will also be deleted.`
        )
    ) {

        return;

    }


    state.employees =
        state.employees.filter(
            employee =>
                employee.id !== id
        );


    state.transactions =
        state.transactions.filter(
            transaction =>
                transaction.employeeId !== id
        );


    state.leaves =
        state.leaves.filter(
            leave =>
                leave.employeeId !== id
        );


    save();

    renderAll();

}


/* =====================================================
   ADD TRANSACTION
===================================================== */

function addTransaction() {

    if (
        !state.employees.length
    ) {

        alert(
            "Please add employees first."
        );

        return;

    }


    openModal(

        "Add Payroll Transaction",

        `

        <div class="form-grid">


            <div class="form-field">

                <label>
                    Employee
                </label>

                <select
                    name="employeeId"
                    required
                >

                    ${employeeOptions()}

                </select>

            </div>


            <div class="form-field">

                <label>
                    Date
                </label>

                <input
                    name="date"
                    type="date"
                    value="${
                        new Date()
                            .toISOString()
                            .slice(0, 10)
                    }"
                    required
                >

            </div>


            <div class="form-field">

                <label>
                    Type
                </label>

                <select
                    name="type"
                    required
                >

                    <option value="salary">
                        Salary Paid
                    </option>

                    <option value="advance">
                        Advance
                    </option>

                    <option value="loan">
                        Loan Given
                    </option>

                    <option value="loan_repayment">
                        Loan Repayment
                    </option>

                    <option value="adjustment">
                        Other Adjustment
                    </option>

                </select>

            </div>


            <div class="form-field">

                <label>
                    Amount (AED)
                </label>

                <input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                >

            </div>


            <div class="form-field full">

                <label>
                    Note
                </label>

                <input
                    name="note"
                    placeholder="Optional note"
                >

            </div>


        </div>


        <div class="form-actions">


            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Save Transaction
            </button>


        </div>

        `,

        formData => {

            state.transactions.push({

                id:
                    generateID("TX"),

                employeeId:
                    formData.get(
                        "employeeId"
                    ),

                date:
                    formData.get(
                        "date"
                    ),

                type:
                    formData.get(
                        "type"
                    ),

                amount:
                    Number(
                        formData.get(
                            "amount"
                        )
                    ),

                note:
                    formData
                        .get("note")
                        .trim()

            });


            save();

            closeModal();

            renderAll();

        }

    );

}


/* =====================================================
   DELETE TRANSACTION
===================================================== */

function deleteTransaction(id) {

    if (
        !confirm(
            "Delete this transaction?"
        )
    ) {

        return;

    }


    state.transactions =
        state.transactions.filter(
            transaction =>
                transaction.id !== id
        );


    save();

    renderAll();

}


/* =====================================================
   ADD LEAVE
===================================================== */

function addLeave() {

    if (
        !state.employees.length
    ) {

        alert(
            "Please add employees first."
        );

        return;

    }


    openModal(

        "Record Leave",

        `

        <div class="form-grid">


            <div class="form-field full">

                <label>
                    Employee
                </label>

                <select
                    name="employeeId"
                    required
                >

                    ${employeeOptions()}

                </select>

            </div>


            <div class="form-field">

                <label>
                    Start Date
                </label>

                <input
                    name="startDate"
                    type="date"
                    required
                >

            </div>


            <div class="form-field">

                <label>
                    End Date
                </label>

                <input
                    name="endDate"
                    type="date"
                    required
                >

            </div>


            <div class="form-field">

                <label>
                    Number of Days
                </label>

                <input
                    name="days"
                    type="number"
                    min="1"
                    step="1"
                    required
                >

            </div>


            <div class="form-field">

                <label>
                    Reason
                </label>

                <input
                    name="reason"
                    placeholder="Annual leave / sick leave / etc."
                >

            </div>


        </div>


        <div class="form-actions">


            <button
                type="button"
                class="action-btn"
                onclick="closeModal()"
            >
                Cancel
            </button>


            <button
                type="submit"
                class="primary"
            >
                Save Leave
            </button>


        </div>

        `,

        formData => {

            const startDate =
                formData.get(
                    "startDate"
                );


            const endDate =
                formData.get(
                    "endDate"
                );


            if (
                new Date(endDate) <
                new Date(startDate)
            ) {

                alert(
                    "End date cannot be before start date."
                );

                return;

            }


            state.leaves.push({

                id:
                    generateID("LV"),

                employeeId:
                    formData.get(
                        "employeeId"
                    ),

                startDate,

                endDate,

                days:
                    Number(
                        formData.get(
                            "days"
                        )
                    ),

                reason:
                    formData
                        .get("reason")
                        .trim()

            });


            save();

            closeModal();

            renderAll();

        }

    );

}


/* =====================================================
   DELETE LEAVE
===================================================== */

function deleteLeave(id) {

    if (
        !confirm(
            "Delete this leave record?"
        )
    ) {

        return;

    }


    state.leaves =
        state.leaves.filter(
            leave =>
                leave.id !== id
        );


    save();

    renderAll();

}


/* =====================================================
   NAVIGATION
===================================================== */

document
    .querySelectorAll(".nav-btn")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                if (
                    button.id ===
                    "darkModeBtn"
                ) {

                    return;

                }


                document
                    .querySelectorAll(
                        ".nav-btn"
                    )
                    .forEach(
                        btn =>
                            btn.classList.remove(
                                "active"
                            )
                    );


                document
                    .querySelectorAll(
                        ".section"
                    )
                    .forEach(
                        section =>
                            section.classList.remove(
                                "active"
                            )
                    );


                button.classList.add(
                    "active"
                );


                const section =
                    document.getElementById(
                        button.dataset.section
                    );


                if (section) {

                    section.classList.add(
                        "active"
                    );

                }


                if (
                    $("pageTitle")
                ) {

                    const titles = {

                        dashboard:
                            "Payroll Dashboard",

                        employees:
                            "Employees",

                        transactions:
                            "Salary / Advances / Loans",

                        leave:
                            "Staff Leave",

                        reports:
                            "Monthly Payroll Report"

                    };


                    $("pageTitle").textContent =
                        titles[
                            button.dataset.section
                        ] ||
                        button.textContent.trim();

                }

            }
        );

    });


/* =====================================================
   BUTTON EVENTS
===================================================== */

if ($("addEmployeeBtn"))
    $("addEmployeeBtn").onclick =
        addEmployee;


if ($("addTransactionBtn"))
    $("addTransactionBtn").onclick =
        addTransaction;


if ($("addLeaveBtn"))
    $("addLeaveBtn").onclick =
        addLeave;


if ($("dashboardMonth"))
    $("dashboardMonth").onchange =
        renderAll;


if ($("transactionMonth"))
    $("transactionMonth").onchange =
        renderTransactions;


if ($("transactionEmployee"))
    $("transactionEmployee").onchange =
        renderTransactions;


if ($("transactionType"))
    $("transactionType").onchange =
        renderTransactions;


if ($("reportMonth"))
    $("reportMonth").onchange =
        renderReport;


if ($("printReportBtn"))
    $("printReportBtn").onclick =
        () => {

            window.print();

        };


/* =====================================================
   DIGITAL CLOCK
===================================================== */

function updateClock() {

    const clock =
        $("clock");


    if (!clock)
        return;


    clock.textContent =
        new Date().toLocaleString(
            "en-AE",
            {
                dateStyle: "full",
                timeStyle: "medium"
            }
        );

}


setInterval(
    updateClock,
    1000
);


updateClock();


/* =====================================================
   MONTH INITIALIZATION
===================================================== */

if ($("dashboardMonth"))
    $("dashboardMonth").value =
        currentMonth();


if ($("transactionMonth"))
    $("transactionMonth").value =
        currentMonth();


if ($("reportMonth"))
    $("reportMonth").value =
        currentMonth();


/* =====================================================
   DARK MODE
===================================================== */

function updateDarkModeButton() {

    const button =
        $("darkModeBtn");


    if (!button)
        return;


    const dark =
        document.body.classList.contains(
            "dark-mode"
        );


    button.innerHTML =
        dark
            ? "☀ Light Mode"
            : "☾ Dark Mode";

}


function setDarkMode(
    enabled
) {

    if (enabled) {

        document.body.classList.add(
            "dark-mode"
        );


        localStorage.setItem(
            DARK_MODE_KEY,
            "true"
        );

    } else {

        document.body.classList.remove(
            "dark-mode"
        );


        localStorage.setItem(
            DARK_MODE_KEY,
            "false"
        );

    }


    updateDarkModeButton();

}


function toggleDarkMode() {

    const dark =
        document.body.classList.contains(
            "dark-mode"
        );


    setDarkMode(
        !dark
    );

}


const darkModeButton =
    $("darkModeBtn");


if (darkModeButton) {

    darkModeButton.addEventListener(
        "click",
        toggleDarkMode
    );

}


/* =====================================================
   LOAD DARK MODE
===================================================== */

function loadDarkMode() {

    const saved =
        localStorage.getItem(
            DARK_MODE_KEY
        );


    if (
        saved === "true"
    ) {

        document.body.classList.add(
            "dark-mode"
        );

    } else {

        document.body.classList.remove(
            "dark-mode"
        );

    }


    updateDarkModeButton();

}


/* =====================================================
   START APPLICATION
===================================================== */

loadDarkMode();

renderAll();
