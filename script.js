/* =====================================================
   AL JEFOON TENTS
   PAYROLL SYSTEM
   SCRIPT.JS
   VERSION 2.2

   FEATURES:
   - Employee IDs start at EMP003
   - Basic salary only used for salary calculations
   - Food allowance displayed separately
   - Salary / Advance / Loan editing
   - Leave editing
   - Leave dates optional
   - Leave days optional
   - Leave counter counts employees with leave records
   - Employees on leave are excluded from salary reports
   - Dark mode
===================================================== */


/* =====================================================
   STORAGE
===================================================== */

const STORAGE_KEY = "alJefoonPayrollV1";
const DARK_MODE_KEY = "alJefoonPayrollDarkMode";


/* =====================================================
   APPLICATION STATE
===================================================== */

let state =
    JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "null"
    ) || {
        employees: [],
        transactions: [],
        leaves: []
    };


/* =====================================================
   DATA SAFETY
===================================================== */

state.employees =
    Array.isArray(state.employees)
        ? state.employees
        : [];

state.transactions =
    Array.isArray(state.transactions)
        ? state.transactions
        : [];

state.leaves =
    Array.isArray(state.leaves)
        ? state.leaves
        : [];


/* =====================================================
   SAVE DATA
===================================================== */

function save() {

    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );

}


/* =====================================================
   HELPER
===================================================== */

const $ = id =>
    document.getElementById(id);


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

    if (!date) return "";

    const d = new Date(date);

    if (isNaN(d)) return "";

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
   AUTOMATIC EMPLOYEE ID
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
   CHECK IF EMPLOYEE IS ON LEAVE
===================================================== */

function isEmployeeOnLeave(
    employee,
    month
) {

    return state.leaves.some(
        leave => {

            if (
                leave.employeeId !==
                employee.id
            ) {

                return false;

            }


            /*
               If there is no start date,
               keep the existing behaviour and
               count the leave under the
               selected month.
            */

            if (!leave.startDate) {

                return true;

            }


            /*
               If there is a start date but
               no end date, match the start
               date to the selected month.
            */

            if (!leave.endDate) {

                return (
                    monthKey(
                        leave.startDate
                    ) === month
                );

            }


            /*
               Leave with both dates:
               check whether the leave period
               overlaps the selected month.
            */

            const [year, monthNumber] =
                month.split("-").map(Number);


            const daysInMonth =
                new Date(
                    year,
                    monthNumber,
                    0
                ).getDate();


            const leaveStart =
                new Date(
                    leave.startDate +
                    "T00:00:00"
                );


            const leaveEnd =
                new Date(
                    leave.endDate +
                    "T00:00:00"
                );


            const monthStart =
                new Date(
                    year,
                    monthNumber - 1,
                    1
                );


            const monthEnd =
                new Date(
                    year,
                    monthNumber - 1,
                    daysInMonth
                );


            return (
                leaveStart <= monthEnd &&
                leaveEnd >= monthStart
            );

        }
    );

}


/* =====================================================
   GET SALARY PAYMENTS FOR MONTH
===================================================== */

function getMonthlySalaryPaid(
    employee,
    month
) {

    return state.transactions
        .filter(
            transaction =>

                transaction.employeeId ===
                employee.id &&

                transaction.type ===
                "salary" &&

                monthKey(
                    transaction.date
                ) === month
        )
        .reduce(
            (
                total,
                transaction
            ) =>

                total +
                Number(
                    transaction.amount || 0
                ),

            0
        );

}


/* =====================================================
   MONTHLY PAYROLL CALCULATION
===================================================== */

function payrollFor(
    employee,
    month
) {

    const basicSalary =
        Number(
            employee.salary || 0
        );


    const foodAllowance =
        Number(
            employee.food || 0
        );


    /* =================================================
       CHECK IF EMPLOYEE IS ON LEAVE

       Employees on leave are excluded from
       salary calculations for the selected
       monthly report.

       Their salary will NOT be counted as
       fully paid, paid, pending, or due.
    ================================================= */

    const employeeOnLeave =
        isEmployeeOnLeave(
            employee,
            month
        );


    /* =================================================
       ACTUAL NUMBER OF DAYS IN SELECTED MONTH
    ================================================= */

    const [year, monthNumber] =
        month.split("-").map(Number);


    const daysInMonth =
        new Date(
            year,
            monthNumber,
            0
        ).getDate();


    /* =================================================
       LEAVE DAYS

       Leave is unpaid.

       If Start Date and End Date exist,
       actual calendar days are calculated.

       If leave crosses into another month,
       only the days belonging to the selected
       month are counted.

       If dates are not available, the existing
       manually entered leave days are used.
    ================================================= */

    let leaveDays = 0;


    state.leaves
        .filter(
            leave => {

                if (
                    leave.employeeId !==
                    employee.id
                ) {

                    return false;

                }


                /*
                   If no start date exists,
                   keep the existing behaviour and
                   use the manually entered days.
                */

                if (!leave.startDate) {

                    return true;

                }


                /*
                   If there is a start date but
                   no end date, use the existing
                   manually entered days only if
                   the start date belongs to the
                   selected month.
                */

                if (!leave.endDate) {

                    return (
                        monthKey(
                            leave.startDate
                        ) === month
                    );

                }


                /*
                   A leave record with both dates
                   belongs to the selected month if
                   the leave period overlaps that month.
                */

                const leaveStart =
                    new Date(
                        leave.startDate +
                        "T00:00:00"
                    );


                const leaveEnd =
                    new Date(
                        leave.endDate +
                        "T00:00:00"
                    );


                const monthStart =
                    new Date(
                        year,
                        monthNumber - 1,
                        1
                    );


                const monthEnd =
                    new Date(
                        year,
                        monthNumber - 1,
                        daysInMonth
                    );


                return (
                    leaveStart <= monthEnd &&
                    leaveEnd >= monthStart
                );

            }
        )
        .forEach(
            leave => {

                /*
                   No start date:
                   use the existing manually
                   entered number of days.
                */

                if (!leave.startDate) {

                    leaveDays +=
                        Number(
                            leave.days || 0
                        );

                    return;

                }


                /*
                   Start date exists but there is
                   no end date:
                   use the existing manually
                   entered days.
                */

                if (!leave.endDate) {

                    leaveDays +=
                        Number(
                            leave.days || 0
                        );

                    return;

                }


                const leaveStart =
                    new Date(
                        leave.startDate +
                        "T00:00:00"
                    );


                const leaveEnd =
                    new Date(
                        leave.endDate +
                        "T00:00:00"
                    );


                const monthStart =
                    new Date(
                        year,
                        monthNumber - 1,
                        1
                    );


                const monthEnd =
                    new Date(
                        year,
                        monthNumber - 1,
                        daysInMonth
                    );


                /*
                   Find the part of the leave
                   that falls inside this month.
                */

                const actualStart =
                    leaveStart >
                    monthStart
                        ? leaveStart
                        : monthStart;


                const actualEnd =
                    leaveEnd <
                    monthEnd
                        ? leaveEnd
                        : monthEnd;


                if (
                    actualStart <=
                    actualEnd
                ) {

                    const difference =
                        actualEnd.getTime() -
                        actualStart.getTime();


                    /*
                       +1 because both the start
                       and end date count as leave days.
                    */

                    const actualDays =
                        Math.floor(
                            difference /
                            (1000 * 60 * 60 * 24)
                        ) + 1;


                    leaveDays +=
                        actualDays;

                }

            }
        );


    /*
       Prevent leave days from exceeding
       the actual number of days in the month.
    */

    leaveDays =
        Math.min(
            leaveDays,
            daysInMonth
        );


    /* =================================================
       UNPAID LEAVE SALARY DEDUCTION
    ================================================= */

    const dailySalary =
        daysInMonth > 0
            ? basicSalary / daysInMonth
            : 0;


    const leaveDeduction =
        dailySalary *
        leaveDays;


    /*
       Salary payable after unpaid leave.
    */

    let salaryDue =
        Math.max(
            0,
            basicSalary -
            leaveDeduction
        );


    /* =================================================
       SALARY ALREADY PAID
    ================================================= */

    const salaryPaid =
        getMonthlySalaryPaid(
            employee,
            month
        );


    /*
       Employees on leave must be excluded
       from salary reporting.

       Their salary is therefore set to zero
       for the selected report.
    */

    if (employeeOnLeave) {

        salaryDue = 0;

    }


    /*
       Pending salary is now calculated from
       the salary remaining after unpaid leave.
    */

    const pendingSalary =
        Math.max(
            0,
            salaryDue -
            salaryPaid
        );


    let status =
        "PENDING";


    /*
       IMPORTANT:

       Employees on leave must NEVER be shown
       as FULLY PAID.
    */

    if (employeeOnLeave) {

        status =
            "ON LEAVE";

    } else if (
        salaryDue <= 0
    ) {

        status =
            "FULLY PAID";

    } else if (
        salaryPaid >=
        salaryDue
    ) {

        status =
            "FULLY PAID";

    } else if (
        salaryPaid > 0
    ) {

        status =
            "PARTIALLY PAID";

    }


    const advances =
        state.transactions
            .filter(
                transaction =>

                    transaction.employeeId ===
                    employee.id &&

                    transaction.type ===
                    "advance" &&

                    monthKey(
                        transaction.date
                    ) === month
            )
            .reduce(
                (
                    total,
                    transaction
                ) =>
                    total +
                    Number(
                        transaction.amount || 0
                    ),

                0
            );


    const loanRepayments =
        state.transactions
            .filter(
                transaction =>

                    transaction.employeeId ===
                    employee.id &&

                    transaction.type ===
                    "loan_repayment" &&

                    monthKey(
                        transaction.date
                    ) === month
            )
            .reduce(
                (
                    total,
                    transaction
                ) =>
                    total +
                    Number(
                        transaction.amount || 0
                    ),

                0
            );


    const adjustments =
        state.transactions
            .filter(
                transaction =>

                    transaction.employeeId ===
                    employee.id &&

                    transaction.type ===
                    "adjustment" &&

                    monthKey(
                        transaction.date
                    ) === month
            )
            .reduce(
                (
                    total,
                    transaction
                ) =>
                    total +
                    Number(
                        transaction.amount || 0
                    ),

                0
            );


    return {

        salary:
            basicSalary,

        food:
            foodAllowance,

        salaryDue:
            salaryDue,

        salaryPaid:
            employeeOnLeave
                ? 0
                : Math.min(
                    salaryPaid,
                    salaryDue
                ),

        pending:
            employeeOnLeave
                ? 0
                : pendingSalary,

        status,

        advances,

        loanRepayments,

        adjustments,

        leaveDays,

        onLeave:
            employeeOnLeave

    };

}


/* =====================================================
   EMPLOYEES CURRENTLY ON LEAVE
=====================================================

   IMPORTANT:

   This does NOT depend on the number of days.

   Example:

   Employee 1 - leave record - days blank
   Employee 2 - leave record - days blank
   Employee 3 - leave record - days blank

   Result = 3 employees on leave.
===================================================== */

function getEmployeesOnLeave(month) {

    const employeeIDs =
        new Set();


    state.leaves.forEach(leave => {

        if (!leave.employeeId)
            return;


        /*
           If there is a start date,
           match it to selected month.
        */

        if (leave.startDate) {

            if (
                monthKey(
                    leave.startDate
                ) !== month
            ) {

                return;

            }

        }


        /*
           If no date exists,
           count the leave under
           the selected month.
        */

        employeeIDs.add(
            leave.employeeId
        );

    });


    return employeeIDs.size;

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
   STATUS HTML
===================================================== */

function statusHTML(
    status
) {

    if (
        status ===
        "ON LEAVE"
    ) {

        return `
            <span class="status leave">
                ON LEAVE
            </span>
        `;

    }


    if (
        status ===
        "FULLY PAID"
    ) {

        return `
            <span class="status paid">
                FULLY PAID
            </span>
        `;

    }


    if (
        status ===
        "PARTIALLY PAID"
    ) {

        return `
            <span class="status partial">
                PARTIALLY PAID
            </span>
        `;

    }


    return `
        <span class="status pending">
            PENDING
        </span>
    `;

}


/* =====================================================
   RENDER EVERYTHING
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
   EMPLOYEE DROPDOWNS
===================================================== */

function populateEmployeeSelects() {

    const select =
        $("transactionEmployee");


    if (!select)
        return;


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
                            employee.id
                        )}
                        -
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
                        employee.id
                    )}
                    -
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


    if (!monthInput)
        return;


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


    const totalSalaries =
        payroll.reduce(
            (
                total,
                row
            ) =>
                total +
                row.salaryDue,

            0
        );


    const totalFood =
        payroll.reduce(
            (
                total,
                row
            ) =>
                total +
                row.food,

            0
        );


    const totalPaid =
        payroll.reduce(
            (
                total,
                row
            ) =>
                total +
                row.salaryPaid,

            0
        );


    const totalPending =
        payroll.reduce(
            (
                total,
                row
            ) =>
                total +
                row.pending,

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


    /*
       FIXED LEAVE COUNT
    */

    const employeesOnLeave =
        getEmployeesOnLeave(
            month
        );


    const fullyPaid =
        payroll.filter(
            row =>
                row.status ===
                "FULLY PAID"
        ).length;


    const partiallyPaid =
        payroll.filter(
            row =>
                row.status ===
                "PARTIALLY PAID"
        ).length;


    const pendingEmployees =
        payroll.filter(
            row =>
                row.status ===
                "PENDING"
        ).length;


    if ($("statEmployees"))
        $("statEmployees").textContent =
            state.employees.length;


    if ($("statSalaries"))
        $("statSalaries").textContent =
            money(totalSalaries);


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


    if ($("statFullyPaid"))
        $("statFullyPaid").textContent =
            fullyPaid;


    if ($("statPartiallyPaid"))
        $("statPartiallyPaid").textContent =
            partiallyPaid;


    if ($("statPendingEmployees"))
        $("statPendingEmployees").textContent =
            pendingEmployees;


    if ($("statFood"))
        $("statFood").textContent =
            money(totalFood);


    if (!$("dashboardTable"))
        return;


    $("dashboardTable").innerHTML = `

        <thead>

            <tr>

                <th>Employee ID</th>

                <th>Employee</th>

                <th class="num">
                    Basic Salary
                </th>

                <th class="num">
                    Food Allowance
                </th>

                <th class="num">
                    Salary Paid
                </th>

                <th class="num">
                    Pending Salary
                </th>

                <th>Status</th>

                <th>Leave</th>

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
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            employee.name
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            row.onLeave
                                                ? 0
                                                : row.salary
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            row.food
                                        )}
                                    </td>

                                    <td class="num">
                                        <b>
                                            ${money(
                                                row.salaryPaid
                                            )}
                                        </b>
                                    </td>

                                    <td class="num">
                                        <b>
                                            ${money(
                                                row.pending
                                            )}
                                        </b>
                                    </td>

                                    <td>
                                        ${statusHTML(
                                            row.status
                                        )}
                                    </td>

                                    <td>
                                        ${
                                            row.leaveDays
                                                ?
                                            `${row.leaveDays} day(s)`
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
                            colspan="8"
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
   EMPLOYEE TABLE
===================================================== */

function renderEmployees() {

    if (!$("employeesTable"))
        return;


    $("employeesTable").innerHTML = `

        <thead>

            <tr>

                <th>Employee ID</th>

                <th>Employee</th>

                <th class="num">
                    Basic Salary
                </th>

                <th class="num">
                    Food Allowance
                </th>

                <th class="num">
                    Salary + Food
                </th>

                <th class="num">
                    Loan Outstanding
                </th>

                <th>Actions</th>

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
   TRANSACTIONS TABLE
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
                (
                    a,
                    b
                ) =>
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
            "Salary Payment",

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
                                        onclick="editTransaction('${transaction.id}')"
                                    >
                                        Edit
                                    </button>

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
   LEAVE TABLE
===================================================== */

function renderLeave() {

    if (!$("leaveTable"))
        return;


    const rows =
        [...state.leaves]
            .sort(
                (
                    a,
                    b
                ) => {

                    const dateA =
                        a.startDate
                            ? new Date(a.startDate)
                            : new Date(0);

                    const dateB =
                        b.startDate
                            ? new Date(b.startDate)
                            : new Date(0);

                    return dateB - dateA;

                }
            );


    $("leaveTable").innerHTML = `

        <thead>

            <tr>

                <th>Employee</th>

                <th>Start Date</th>

                <th>End Date</th>

                <th>Days</th>

                <th>Reason</th>

                <th>Actions</th>

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
                                    ${
                                        leave.startDate
                                            ?
                                        escapeHTML(
                                            leave.startDate
                                        )
                                            :
                                        "-"
                                    }
                                </td>

                                <td>
                                    ${
                                        leave.endDate
                                            ?
                                        escapeHTML(
                                            leave.endDate
                                        )
                                            :
                                        "-"
                                    }
                                </td>

                                <td>
                                    ${
                                        leave.days
                                            ?
                                        leave.days
                                            :
                                        "-"
                                    }
                                </td>

                                <td>
                                    ${escapeHTML(
                                        leave.reason
                                    )}
                                </td>

                                <td>

                                    <button
                                        class="action-btn"
                                        onclick="editLeave('${leave.id}')"
                                    >
                                        Edit
                                    </button>

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


    const totalSalaries =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                row.payroll.salaryDue,

            0
        );


    const totalFood =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                row.payroll.food,

            0
        );


    const totalPaid =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                row.payroll.salaryPaid,

            0
        );


    const totalPending =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                row.payroll.pending,

            0
        );


    const fullyPaid =
        rows.filter(
            row =>
                row.payroll.status ===
                "FULLY PAID"
        ).length;


    const partiallyPaid =
        rows.filter(
            row =>
                row.payroll.status ===
                "PARTIALLY PAID"
        ).length;


    const pendingEmployees =
        rows.filter(
            row =>
                row.payroll.status ===
                "PENDING"
        ).length;


    const totalAdvances =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                row.payroll.advances,

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
                <span>Total Basic Salaries</span>
                <strong>
                    ${money(totalSalaries)}
                </strong>
            </div>

            <div class="summary-box">
                <span>Food Allowance</span>
                <strong>
                    ${money(totalFood)}
                </strong>
            </div>

            <div class="summary-box">
                <span>Salary Paid</span>
                <strong>
                    ${money(totalPaid)}
                </strong>
            </div>

            <div class="summary-box">
                <span>Pending Salary</span>
                <strong>
                    ${money(totalPending)}
                </strong>
            </div>

            <div class="summary-box">
                <span>Fully Paid</span>
                <strong>
                    ${fullyPaid}
                </strong>
            </div>

            <div class="summary-box">
                <span>Partially Paid</span>
                <strong>
                    ${partiallyPaid}
                </strong>
            </div>

            <div class="summary-box">
                <span>Pending</span>
                <strong>
                    ${pendingEmployees}
                </strong>
            </div>

            <div class="summary-box">
                <span>Advances</span>
                <strong>
                    ${money(totalAdvances)}
                </strong>
            </div>

            <div class="summary-box">
                <span>Outstanding Loans</span>
                <strong>
                    ${money(totalLoans)}
                </strong>
            </div>

        `;

    }


    if (!$("reportTable"))
        return;


    $("reportTable").innerHTML = `

        <thead>

            <tr>

                <th>Employee ID</th>

                <th>Employee</th>

                <th class="num">
                    Basic Salary
                </th>

                <th class="num">
                    Food Allowance
                </th>

                <th class="num">
                    Salary Paid
                </th>

                <th class="num">
                    Pending Salary
                </th>

                <th>Status</th>

                <th class="num">
                    Advances
                </th>

                <th class="num">
                    Loan Repayment
                </th>

                <th>Leave</th>

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
                                        row.payroll.onLeave
                                            ? 0
                                            : row.payroll.salaryDue
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.food
                                    )}
                                </td>

                                <td class="num">
                                    <b>
                                        ${money(
                                            row.payroll.salaryPaid
                                        )}
                                    </b>
                                </td>

                                <td class="num">
                                    <b>
                                        ${money(
                                            row.payroll.pending
                                        )}
                                    </b>
                                </td>

                                <td>
                                    ${statusHTML(
                                        row.payroll.status
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

                                <td>
                                    ${
                                        row.payroll.leaveDays
                                            ?
                                        `${row.payroll.leaveDays} day(s)`
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
                            colspan="10"
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
                    Basic Salary (AED)
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

                id,

                name,

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
                    Basic Salary (AED)
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
   TRANSACTION FORM HTML
===================================================== */

function transactionFormHTML(
    transaction = null
) {

    const today =
        new Date()
            .toISOString()
            .slice(0, 10);


    const employeeId =
        transaction
            ? transaction.employeeId
            : "";


    const date =
        transaction
            ? transaction.date
            : today;


    const type =
        transaction
            ? transaction.type
            : "salary";


    const amount =
        transaction
            ? transaction.amount
            : "";


    const note =
        transaction
            ? transaction.note || ""
            : "";


    return `

        <div class="form-grid">

            <div class="form-field">

                <label>
                    Employee
                </label>

                <select
                    name="employeeId"
                    required
                >

                    ${employeeOptions(
                        employeeId
                    )}

                </select>

            </div>


            <div class="form-field">

                <label>
                    Date
                </label>

                <input
                    name="date"
                    type="date"
                    value="${escapeHTML(
                        date
                    )}"
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

                    <option
                        value="salary"
                        ${
                            type === "salary"
                                ? "selected"
                                : ""
                        }
                    >
                        Salary Payment
                    </option>

                    <option
                        value="advance"
                        ${
                            type === "advance"
                                ? "selected"
                                : ""
                        }
                    >
                        Advance
                    </option>

                    <option
                        value="loan"
                        ${
                            type === "loan"
                                ? "selected"
                                : ""
                        }
                    >
                        Loan Given
                    </option>

                    <option
                        value="loan_repayment"
                        ${
                            type === "loan_repayment"
                                ? "selected"
                                : ""
                        }
                    >
                        Loan Repayment
                    </option>

                    <option
                        value="adjustment"
                        ${
                            type === "adjustment"
                                ? "selected"
                                : ""
                        }
                    >
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
                    value="${escapeHTML(
                        amount
                    )}"
                    required
                >

            </div>


            <div class="form-field full">

                <label>
                    Note
                </label>

                <input
                    name="note"
                    value="${escapeHTML(
                        note
                    )}"
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
                ${
                    transaction
                        ? "Save Changes"
                        : "Save Transaction"
                }
            </button>

        </div>

    `;

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

        transactionFormHTML(),

        formData => {

            const employeeId =
                formData.get(
                    "employeeId"
                );


            const date =
                formData.get(
                    "date"
                );


            const type =
                formData.get(
                    "type"
                );


            const amount =
                Number(
                    formData.get(
                        "amount"
                    )
                );


            if (
                amount <= 0
            ) {

                alert(
                    "Please enter an amount greater than zero."
                );

                return;

            }


            state.transactions.push({

                id:
                    generateID("TX"),

                employeeId,

                date,

                type,

                amount,

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
   EDIT TRANSACTION
===================================================== */

function editTransaction(id) {

    const transaction =
        state.transactions.find(
            item =>
                item.id === id
        );


    if (!transaction)
        return;


    openModal(

        "Edit Payroll Transaction",

        transactionFormHTML(
            transaction
        ),

        formData => {

            const employeeId =
                formData.get(
                    "employeeId"
                );


            const date =
                formData.get(
                    "date"
                );


            const type =
                formData.get(
                    "type"
                );


            const amount =
                Number(
                    formData.get(
                        "amount"
                    )
                );


            if (
                amount <= 0
            ) {

                alert(
                    "Please enter an amount greater than zero."
                );

                return;

            }


            transaction.employeeId =
                employeeId;


            transaction.date =
                date;


            transaction.type =
                type;


            transaction.amount =
                amount;


            transaction.note =
                formData
                    .get("note")
                    .trim();


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
   LEAVE FORM HTML
===================================================== */

function leaveFormHTML(
    leave = null
) {

    const employeeId =
        leave
            ? leave.employeeId
            : "";


    const startDate =
        leave
            ? leave.startDate || ""
            : "";


    const endDate =
        leave
            ? leave.endDate || ""
            : "";


    const days =
        leave
            ? leave.days || ""
            : "";


    const reason =
        leave
            ? leave.reason || ""
            : "";


    return `

        <div class="form-grid">

            <div class="form-field full">

                <label>
                    Employee
                </label>

                <select
                    name="employeeId"
                    required
                >

                    ${employeeOptions(
                        employeeId
                    )}

                </select>

            </div>


            <div class="form-field">

                <label>
                    Start Date
                    <span style="opacity:.6">
                        (Optional)
                    </span>
                </label>

                <input
                    name="startDate"
                    type="date"
                    value="${escapeHTML(
                        startDate
                    )}"
                >

            </div>


            <div class="form-field">

                <label>
                    End Date
                    <span style="opacity:.6">
                        (Optional)
                    </span>
                </label>

                <input
                    name="endDate"
                    type="date"
                    value="${escapeHTML(
                        endDate
                    )}"
                >

            </div>


            <div class="form-field">

                <label>
                    Number of Days
                    <span style="opacity:.6">
                        (Optional)
                    </span>
                </label>

                <input
                    name="days"
                    type="number"
                    min="0"
                    step="1"
                    value="${escapeHTML(
                        days
                    )}"
                >

            </div>


            <div class="form-field">

                <label>
                    Reason
                </label>

                <input
                    name="reason"
                    value="${escapeHTML(
                        reason
                    )}"
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
                ${
                    leave
                        ? "Save Changes"
                        : "Save Leave"
                }
            </button>

        </div>

    `;

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

        leaveFormHTML(),

        formData => {

            const startDate =
                formData.get(
                    "startDate"
                );


            const endDate =
                formData.get(
                    "endDate"
                );


            /*
               Only validate dates if
               BOTH dates were entered.
            */

            if (
                startDate &&
                endDate &&
                new Date(endDate) <
                new Date(startDate)
            ) {

                alert(
                    "End date cannot be before start date."
                );

                return;

            }


            const daysValue =
                formData.get(
                    "days"
                );


            state.leaves.push({

                id:
                    generateID("LV"),

                employeeId:
                    formData.get(
                        "employeeId"
                    ),

                startDate:
                    startDate || "",

                endDate:
                    endDate || "",

                days:
                    daysValue
                        ? Number(daysValue)
                        : 0,

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
   EDIT LEAVE
===================================================== */

function editLeave(id) {

    const leave =
        state.leaves.find(
            item =>
                item.id === id
        );


    if (!leave)
        return;


    openModal(

        "Edit Leave",

        leaveFormHTML(
            leave
        ),

        formData => {

            const startDate =
                formData.get(
                    "startDate"
                );


            const endDate =
                formData.get(
                    "endDate"
                );


            /*
               Only validate when both
               dates are present.
            */

            if (
                startDate &&
                endDate &&
                new Date(endDate) <
                new Date(startDate)
            ) {

                alert(
                    "End date cannot be before start date."
                );

                return;

            }


            const daysValue =
                formData.get(
                    "days"
                );


            leave.employeeId =
                formData.get(
                    "employeeId"
                );


            leave.startDate =
                startDate || "";


            leave.endDate =
                endDate || "";


            leave.days =
                daysValue
                    ? Number(daysValue)
                    : 0;


            leave.reason =
                formData
                    .get("reason")
                    .trim();


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
    .forEach(
        button => {

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

        }
    );


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
   INITIAL MONTHS
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
