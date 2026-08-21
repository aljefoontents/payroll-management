/* =====================================================
   AL JEFOON TENTS
   PAYROLL SYSTEM
   SCRIPT.JS
   VERSION 2.3

   FEATURES:
   - Employee IDs start at EMP003
   - Basic salary used for salary calculations
   - Food allowance displayed separately
   - Salary / Advance / Loan editing
   - Leave editing
   - Leave dates optional
   - Automatic pending salary calculation
   - Previous pending salary calculation
   - Employee leave status
   - Outstanding loan calculation
   - Monthly payroll reports
   - Multiple print report options
   - Salary payments print
   - Advances print
   - Loan repayments print
===================================================== */


/* =====================================================
   STORAGE
===================================================== */

const STORAGE_KEY = "alJefoonPayrollV2";

let state = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || "null"
);

if (!state) {
    state = {
        employees: [],
        transactions: [],
        leaves: []
    };
}

state.employees = Array.isArray(state.employees)
    ? state.employees
    : [];

state.transactions = Array.isArray(state.transactions)
    ? state.transactions
    : [];

state.leaves = Array.isArray(state.leaves)
    ? state.leaves
    : [];


/* =====================================================
   HELPERS
===================================================== */

const $ = id => document.getElementById(id);


function saveState() {
    localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
    );
}


function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function money(value) {
    return "AED " +
        Number(value || 0).toLocaleString(
            "en-AE",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );
}


function currentMonth() {
    const date = new Date();

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0")
    );
}


function monthKey(date) {

    if (!date) {
        return "";
    }

    const d = new Date(date + "T00:00:00");

    if (isNaN(d.getTime())) {
        return "";
    }

    return (
        d.getFullYear() +
        "-" +
        String(
            d.getMonth() + 1
        ).padStart(2, "0")
    );
}


function employeeName(employeeId) {

    const employee =
        state.employees.find(
            employee =>
                employee.id === employeeId
        );

    return employee
        ? employee.name
        : "Unknown Employee";
}


function getEmployee(employeeId) {

    return state.employees.find(
        employee =>
            employee.id === employeeId
    );
}


/* =====================================================
   EMPLOYEE ID
===================================================== */

function getNextEmployeeID() {

    let highestNumber = 2;

    state.employees.forEach(
        employee => {

            const match =
                String(employee.id || "")
                    .match(/^EMP(\d+)$/i);

            if (!match) {
                return;
            }

            const number =
                parseInt(
                    match[1],
                    10
                );

            if (
                number > highestNumber
            ) {
                highestNumber = number;
            }
        }
    );

    return (
        "EMP" +
        String(
            highestNumber + 1
        ).padStart(3, "0")
    );
}


/* =====================================================
   MONTHLY SALARY PAYMENTS
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
   EMPLOYEE ON LEAVE
===================================================== */

function isEmployeeOnLeave(
    employee,
    month
) {

    if (!employee) {
        return false;
    }

    return state.leaves.some(
        leave => {

            if (
                leave.employeeId !==
                employee.id
            ) {
                return false;
            }

            /*
               No start date:
               keep leave under selected month.
            */

            if (!leave.startDate) {
                return true;
            }

            /*
               Start date but no end date:
               leave belongs to selected month.
            */

            if (!leave.endDate) {

                return (
                    monthKey(
                        leave.startDate
                    ) === month
                );
            }

            const [
                year,
                monthNumber
            ] =
                month
                    .split("-")
                    .map(Number);

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
   MONTHLY LEAVE DAYS
===================================================== */

function getLeaveDays(
    employee,
    month
) {

    if (!employee) {
        return 0;
    }

    const [
        year,
        monthNumber
    ] =
        month
            .split("-")
            .map(Number);

    const daysInMonth =
        new Date(
            year,
            monthNumber,
            0
        ).getDate();

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

    let leaveDays = 0;

    state.leaves
        .filter(
            leave =>
                leave.employeeId ===
                    employee.id
        )
        .forEach(
            leave => {

                if (!leave.startDate) {

                    leaveDays +=
                        Number(
                            leave.days || 0
                        );

                    return;
                }

                if (!leave.endDate) {

                    if (
                        monthKey(
                            leave.startDate
                        ) === month
                    ) {

                        leaveDays +=
                            Number(
                                leave.days || 0
                            );
                    }

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

                    const actualDays =
                        Math.floor(
                            difference /
                            (
                                1000 *
                                60 *
                                60 *
                                24
                            )
                        ) + 1;

                    leaveDays +=
                        actualDays;
                }
            }
        );

    return Math.min(
        leaveDays,
        daysInMonth
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


    /*
       Employee on leave:
       salary and food are not calculated.
    */

    const employeeOnLeave =
        isEmployeeOnLeave(
            employee,
            month
        );

    if (employeeOnLeave) {

        return {

            salary: 0,

            food: 0,

            salaryDue: 0,

            salaryPaid: 0,

            pending: 0,

            status: "ON LEAVE",

            advances:
                getMonthlyTransactionTotal(
                    employee.id,
                    month,
                    "advance"
                ),

            loanRepayments:
                getMonthlyTransactionTotal(
                    employee.id,
                    month,
                    "loan_repayment"
                ),

            adjustments:
                getMonthlyTransactionTotal(
                    employee.id,
                    month,
                    "adjustment"
                ),

            leaveDays:
                getLeaveDays(
                    employee,
                    month
                )
        };
    }


    const [
        year,
        monthNumber
    ] =
        month
            .split("-")
            .map(Number);

    const daysInMonth =
        new Date(
            year,
            monthNumber,
            0
        ).getDate();


    /* =================================================
       LEAVE DEDUCTION
    ================================================= */

    const leaveDays =
        getLeaveDays(
            employee,
            month
        );

    const dailySalary =
        daysInMonth > 0
            ? basicSalary /
              daysInMonth
            : 0;

    const leaveDeduction =
        dailySalary *
        leaveDays;

    const salaryDue =
        Math.max(
            0,
            basicSalary -
            leaveDeduction
        );


    /* =================================================
       SALARY PAID
    ================================================= */

    const salaryPaid =
        getMonthlySalaryPaid(
            employee,
            month
        );


    const pendingSalary =
        Math.max(
            0,
            salaryDue -
            salaryPaid
        );


    let status =
        "PENDING";


    if (
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


    return {

        salary:
            basicSalary,

        food:
            foodAllowance,

        salaryDue:
            salaryDue,

        salaryPaid:
            Math.min(
                salaryPaid,
                salaryDue
            ),

        pending:
            pendingSalary,

        status:

            status,

        advances:
            getMonthlyTransactionTotal(
                employee.id,
                month,
                "advance"
            ),

        loanRepayments:
            getMonthlyTransactionTotal(
                employee.id,
                month,
                "loan_repayment"
            ),

        adjustments:
            getMonthlyTransactionTotal(
                employee.id,
                month,
                "adjustment"
            ),

        leaveDays:
            leaveDays
    };
}


/* =====================================================
   TRANSACTION TOTAL
===================================================== */

function getMonthlyTransactionTotal(
    employeeId,
    month,
    type
) {

    return state.transactions
        .filter(
            transaction =>
                transaction.employeeId ===
                    employeeId &&

                transaction.type ===
                    type &&

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
   PREVIOUS MONTH PENDING SALARY
===================================================== */

function getPreviousPendingSalary(
    employee,
    selectedMonth
) {

    const selectedDate =
        new Date(
            selectedMonth +
            "-01T00:00:00"
        );

    let earliestDate = null;

    const months = new Set();

    state.transactions.forEach(
        transaction => {

            if (
                transaction.date
            ) {

                months.add(
                    monthKey(
                        transaction.date
                    )
                );
            }
        }
    );

    state.leaves.forEach(
        leave => {

            if (
                leave.startDate
            ) {

                months.add(
                    monthKey(
                        leave.startDate
                    )
                );
            }
        }
    );

    state.employees.forEach(
        employeeItem => {

            if (
                employeeItem.id ===
                employee.id
            ) {

                const joinMonth =
                    employeeItem.joinDate
                        ? monthKey(
                            employeeItem.joinDate
                        )
                        : null;

                if (joinMonth) {
                    months.add(
                        joinMonth
                    );
                }
            }
        }
    );


    months.forEach(
        key => {

            if (!key) {
                return;
            }

            const parts =
                key
                    .split("-")
                    .map(Number);

            const date =
                new Date(
                    parts[0],
                    parts[1] - 1,
                    1
                );

            if (
                !earliestDate ||
                date < earliestDate
            ) {

                earliestDate =
                    date;
            }
        }
    );


    if (!earliestDate) {
        return 0;
    }


    let checkDate =
        new Date(
            earliestDate.getFullYear(),
            earliestDate.getMonth(),
            1
        );

    let totalPending = 0;


    while (
        checkDate <
        selectedDate
    ) {

        const key =
            `${checkDate.getFullYear()}-${String(
                checkDate.getMonth() + 1
            ).padStart(2, "0")}`;


        const payroll =
            payrollFor(
                employee,
                key
            );


        /*
           ON LEAVE months do not
           create salary pending.
        */

        if (
            payroll.status !==
            "ON LEAVE"
        ) {

            totalPending +=
                Number(
                    payroll.pending || 0
                );
        }


        checkDate =
            new Date(
                checkDate.getFullYear(),
                checkDate.getMonth() + 1,
                1
            );
    }


    return Math.max(
        0,
        totalPending
    );
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
                            transaction.amount || 0
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
                            transaction.amount || 0
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
   EMPLOYEE DROPDOWNS
===================================================== */

function populateEmployeeSelects() {

    const select =
        $("transactionEmployee");

    if (!select) {
        return;
    }


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
                        employee.id ===
                        selected
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

    if (!monthInput) {
        return;
    }


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


    const previousPendingRows =
        state.employees
            .map(
                employee => ({

                    employee,

                    pending:
                        getPreviousPendingSalary(
                            employee,
                            month
                        )
                })
            )
            .filter(
                row =>
                    row.pending > 0
            );


    const totalPreviousPending =
        previousPendingRows.reduce(
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


    const employeesOnLeave =
        state.employees.filter(
            employee =>
                isEmployeeOnLeave(
                    employee,
                    month
                )
        ).length;


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
            money(
                totalSalaries
            );


    if ($("statPaid"))
        $("statPaid").textContent =
            money(
                totalPaid
            );


    if ($("statPending"))
        $("statPending").textContent =
            money(
                totalPending
            );


    if ($("statPreviousPending"))
        $("statPreviousPending").textContent =
            money(
                totalPreviousPending
            );


    if ($("statLoans"))
        $("statLoans").textContent =
            money(
                totalLoans
            );


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
            money(
                totalFood
            );


    /* =================================================
       PREVIOUS PENDING SECTION
    ================================================= */

    const previousHTML = `
        <div
            id="dashboardPreviousPending"
            class="previous-pending-section"
            style="
                margin-top:20px;
                margin-bottom:20px;
            "
        >

            <h3>
                Previous Salary Pending
            </h3>

            ${
                previousPendingRows.length
                    ?

                `
                <div class="table-wrap">
                    <table>

                        <thead>
                            <tr>
                                <th>
                                    Employee ID
                                </th>

                                <th>
                                    Employee
                                </th>

                                <th class="num">
                                    Previous Pending
                                </th>
                            </tr>
                        </thead>

                        <tbody>

                            ${
                                previousPendingRows
                                    .map(
                                        row =>
                                            `
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
                                                    <b>
                                                        ${money(
                                                            row.pending
                                                        )}
                                                    </b>
                                                </td>

                                            </tr>
                                            `
                                    )
                                    .join("")
                            }

                        </tbody>

                    </table>
                </div>
                `

                    :

                `
                <div
                    class="empty"
                    style="
                        padding:15px;
                    "
                >
                    No previous salary pending.
                </div>
                `
            }

        </div>
    `;


    const existingPrevious =
        $("dashboardPreviousPending");


    if (
        existingPrevious
    ) {

        existingPrevious.outerHTML =
            previousHTML;

    } else if (
        $("dashboardTable")
    ) {

        $("dashboardTable")
            .insertAdjacentHTML(
                "beforebegin",
                previousHTML
            );
    }


    if (!$("dashboardTable")) {
        return;
    }


    $("dashboardTable").innerHTML = `

        <thead>

            <tr>

                <th>
                    Employee ID
                </th>

                <th>
                    Employee
                </th>

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

                <th class="num">
                    Previous Pending
                </th>

                <th>
                    Status
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

                            const previousPending =
                                getPreviousPendingSalary(
                                    employee,
                                    month
                                );


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
                                            row.salary
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

                                    <td class="num">

                                        ${
                                            previousPending > 0

                                                ?

                                            `<b>
                                                ${money(
                                                    previousPending
                                                )}
                                            </b>`

                                                :

                                            "-"
                                        }

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

                                            row.status ===
                                            "ON LEAVE"

                                                ?

                                            "ON LEAVE"

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
                            colspan="9"
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

    const table =
        $("employeesTable");

    if (!table) {
        return;
    }


    table.innerHTML = `

        <thead>

            <tr>

                <th>
                    Employee ID
                </th>

                <th>
                    Employee Name
                </th>

                <th class="num">
                    Basic Salary
                </th>

                <th class="num">
                    Food Allowance
                </th>

                <th>
                    Join Date
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
                        employee =>
                            `

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

                                <td>
                                    ${escapeHTML(
                                        employee.joinDate ||
                                        "-"
                                    )}
                                </td>

                                <td>

                                    <button
                                        class="small-btn"
                                        onclick="editEmployee('${employee.id}')"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        class="small-btn danger"
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
                            colspan="6"
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
   ADD EMPLOYEE
===================================================== */

function addEmployee() {

    const name =
        $("employeeName")?.value.trim();

    const salary =
        Number(
            $("employeeSalary")?.value || 0
        );

    const food =
        Number(
            $("employeeFood")?.value || 0
        );

    const joinDate =
        $("employeeJoinDate")?.value || "";


    if (!name) {

        alert(
            "Please enter employee name."
        );

        return;
    }


    const employee = {

        id:
            getNextEmployeeID(),

        name:
            name,

        salary:
            salary,

        food:
            food,

        joinDate:
            joinDate
    };


    state.employees.push(
        employee
    );


    saveState();

    renderAll();


    if ($("employeeName"))
        $("employeeName").value = "";

    if ($("employeeSalary"))
        $("employeeSalary").value = "";

    if ($("employeeFood"))
        $("employeeFood").value = "";

    if ($("employeeJoinDate"))
        $("employeeJoinDate").value = "";


    alert(
        "Employee added successfully."
    );
}


/* =====================================================
   EDIT EMPLOYEE
===================================================== */

function editEmployee(
    employeeId
) {

    const employee =
        getEmployee(
            employeeId
        );

    if (!employee) {
        return;
    }


    const name =
        prompt(
            "Employee Name:",
            employee.name
        );

    if (
        name === null
    ) {
        return;
    }


    const salary =
        prompt(
            "Basic Salary:",
            employee.salary
        );

    if (
        salary === null
    ) {
        return;
    }


    const food =
        prompt(
            "Food Allowance:",
            employee.food
        );

    if (
        food === null
    ) {
        return;
    }


    employee.name =
        name.trim();

    employee.salary =
        Number(salary || 0);

    employee.food =
        Number(food || 0);


    saveState();

    renderAll();
}


/* =====================================================
   DELETE EMPLOYEE
===================================================== */

function deleteEmployee(
    employeeId
) {

    const employee =
        getEmployee(
            employeeId
        );

    if (!employee) {
        return;
    }


    if (
        !confirm(
            `Delete ${employee.name}?`
        )
    ) {
        return;
    }


    state.employees =
        state.employees.filter(
            employee =>
                employee.id !==
                employeeId
        );


    state.transactions =
        state.transactions.filter(
            transaction =>
                transaction.employeeId !==
                employeeId
        );


    state.leaves =
        state.leaves.filter(
            leave =>
                leave.employeeId !==
                employeeId
        );


    saveState();

    renderAll();
}


/* =====================================================
   TRANSACTIONS
===================================================== */

function addTransaction() {

    const employeeId =
        $("transactionEmployee")?.value;

    const type =
        $("transactionType")?.value;

    const amount =
        Number(
            $("transactionAmount")?.value ||
            0
        );

    const date =
        $("transactionDate")?.value ||
        new Date()
            .toISOString()
            .slice(0, 10);

    const notes =
        $("transactionNotes")?.value.trim() ||
        "";


    if (!employeeId) {

        alert(
            "Please select an employee."
        );

        return;
    }


    if (
        !amount ||
        amount <= 0
    ) {

        alert(
            "Please enter a valid amount."
        );

        return;
    }


    if (!type) {

        alert(
            "Please select transaction type."
        );

        return;
    }


    state.transactions.push({

        id:
            Date.now(),

        employeeId:
            employeeId,

        type:
            type,

        amount:
            amount,

        date:
            date,

        notes:
            notes
    });


    saveState();

    renderAll();


    if ($("transactionAmount"))
        $("transactionAmount").value = "";

    if ($("transactionNotes"))
        $("transactionNotes").value = "";


    alert(
        "Transaction added successfully."
    );
}


/* =====================================================
   TRANSACTION RENDER
===================================================== */

function renderTransactions() {

    const table =
        $("transactionsTable");

    if (!table) {
        return;
    }


    const month =
        $("transactionMonth")?.value ||
        currentMonth();

    const employeeId =
        $("transactionEmployee")?.value ||
        "";

    const type =
        $("transactionType")?.value ||
        "";


    let transactions =
        state.transactions.filter(
            transaction => {

                if (
                    monthKey(
                        transaction.date
                    ) !== month
                ) {
                    return false;
                }


                if (
                    employeeId &&
                    transaction.employeeId !==
                    employeeId
                ) {
                    return false;
                }


                if (
                    type &&
                    transaction.type !==
                    type
                ) {
                    return false;
                }


                return true;
            }
        );


    transactions.sort(
        (
            a,
            b
        ) =>
            new Date(
                b.date
            ) -
            new Date(
                a.date
            )
    );


    table.innerHTML = `

        <thead>

            <tr>

                <th>
                    Date
                </th>

                <th>
                    Employee
                </th>

                <th>
                    Type
                </th>

                <th class="num">
                    Amount
                </th>

                <th>
                    Notes
                </th>

                <th>
                    Actions
                </th>

            </tr>

        </thead>


        <tbody>

            ${
                transactions.length

                    ?

                transactions
                    .map(
                        transaction =>
                            `

                            <tr>

                                <td>
                                    ${escapeHTML(
                                        transaction.date
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        employeeName(
                                            transaction.employeeId
                                        )
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        transaction.type
                                    )}
                                </td>

                                <td class="num">
                                    <b>
                                        ${money(
                                            transaction.amount
                                        )}
                                    </b>
                                </td>

                                <td>
                                    ${escapeHTML(
                                        transaction.notes ||
                                        ""
                                    )}
                                </td>

                                <td>

                                    <button
                                        class="small-btn"
                                        onclick="editTransaction(${transaction.id})"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        class="small-btn danger"
                                        onclick="deleteTransaction(${transaction.id})"
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
   EDIT TRANSACTION
===================================================== */

function editTransaction(
    transactionId
) {

    const transaction =
        state.transactions.find(
            item =>
                item.id ===
                transactionId
        );

    if (!transaction) {
        return;
    }


    const amount =
        prompt(
            "Amount:",
            transaction.amount
        );

    if (
        amount === null
    ) {
        return;
    }


    const date =
        prompt(
            "Date (YYYY-MM-DD):",
            transaction.date
        );

    if (
        date === null
    ) {
        return;
    }


    const notes =
        prompt(
            "Notes:",
            transaction.notes || ""
        );


    transaction.amount =
        Number(
            amount || 0
        );

    transaction.date =
        date;

    if (
        notes !== null
    ) {

        transaction.notes =
            notes;
    }


    saveState();

    renderAll();
}


/* =====================================================
   DELETE TRANSACTION
===================================================== */

function deleteTransaction(
    transactionId
) {

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
                transaction.id !==
                transactionId
        );


    saveState();

    renderAll();
}


/* =====================================================
   LEAVE
===================================================== */

function addLeave() {

    const employeeId =
        $("leaveEmployee")?.value;

    const startDate =
        $("leaveStartDate")?.value ||
        "";

    const endDate =
        $("leaveEndDate")?.value ||
        "";

    const days =
        Number(
            $("leaveDays")?.value ||
            0
        );

    const reason =
        $("leaveReason")?.value.trim() ||
        "";


    if (!employeeId) {

        alert(
            "Please select an employee."
        );

        return;
    }


    if (
        !startDate &&
        !days
    ) {

        alert(
            "Please enter leave date or leave days."
        );

        return;
    }


    if (
        startDate &&
        endDate &&
        new Date(
            endDate
        ) <
        new Date(
            startDate
        )
    ) {

        alert(
            "Leave end date cannot be before start date."
        );

        return;
    }


    state.leaves.push({

        id:
            Date.now(),

        employeeId:
            employeeId,

        startDate:
            startDate,

        endDate:
            endDate,

        days:
            days,

        reason:
            reason
    });


    saveState();

    renderAll();


    if ($("leaveStartDate"))
        $("leaveStartDate").value = "";

    if ($("leaveEndDate"))
        $("leaveEndDate").value = "";

    if ($("leaveDays"))
        $("leaveDays").value = "";

    if ($("leaveReason"))
        $("leaveReason").value = "";


    alert(
        "Leave recorded successfully."
    );
}


/* =====================================================
   LEAVE RENDER
===================================================== */

function renderLeave() {

    const table =
        $("leaveTable");

    if (!table) {
        return;
    }


    const leaves =
        [...state.leaves].sort(
            (
                a,
                b
            ) =>
                new Date(
                    b.startDate || 0
                ) -
                new Date(
                    a.startDate || 0
                )
        );


    table.innerHTML = `

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
                leaves.length

                    ?

                leaves
                    .map(
                        leave =>
                            `

                            <tr>

                                <td>
                                    ${escapeHTML(
                                        employeeName(
                                            leave.employeeId
                                        )
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        leave.startDate ||
                                        "-"
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        leave.endDate ||
                                        "-"
                                    )}
                                </td>

                                <td>
                                    ${Number(
                                        leave.days || 0
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        leave.reason ||
                                        ""
                                    )}
                                </td>

                                <td>

                                    <button
                                        class="small-btn"
                                        onclick="editLeave(${leave.id})"
                                    >
                                        Edit
                                    </button>

                                    <button
                                        class="small-btn danger"
                                        onclick="deleteLeave(${leave.id})"
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
                            No leave records.
                        </td>

                    </tr>
                `
            }

        </tbody>
    `;
}


/* =====================================================
   EDIT LEAVE
===================================================== */

function editLeave(
    leaveId
) {

    const leave =
        state.leaves.find(
            item =>
                item.id ===
                leaveId
        );

    if (!leave) {
        return;
    }


    const startDate =
        prompt(
            "Start Date:",
            leave.startDate || ""
        );

    if (
        startDate === null
    ) {
        return;
    }


    const endDate =
        prompt(
            "End Date:",
            leave.endDate || ""
        );

    if (
        endDate === null
    ) {
        return;
    }


    const days =
        prompt(
            "Leave Days:",
            leave.days || 0
        );

    if (
        days === null
    ) {
        return;
    }


    const reason =
        prompt(
            "Reason:",
            leave.reason || ""
        );


    leave.startDate =
        startDate;

    leave.endDate =
        endDate;

    leave.days =
        Number(
            days || 0
        );

    if (
        reason !== null
    ) {

        leave.reason =
            reason;
    }


    saveState();

    renderAll();
}


/* =====================================================
   DELETE LEAVE
===================================================== */

function deleteLeave(
    leaveId
) {

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
                leave.id !==
                leaveId
        );


    saveState();

    renderAll();
}


/* =====================================================
   REPORT
===================================================== */

function renderReport() {

    const table =
        $("reportTable");

    if (!table) {
        return;
    }


    const month =
        $("reportMonth")?.value ||
        currentMonth();


    if ($("reportMonth"))
        $("reportMonth").value =
            month;


    const rows =
        state.employees.map(
            employee => ({

                employee,

                payroll:
                    payrollFor(
                        employee,
                        month
                    ),

                previousPending:
                    getPreviousPendingSalary(
                        employee,
                        month
                    )
            })
        );


    table.innerHTML = `

        <thead>

            <tr>

                <th>
                    Employee ID
                </th>

                <th>
                    Employee
                </th>

                <th class="num">
                    Basic Salary
                </th>

                <th class="num">
                    Food Allowance
                </th>

                <th class="num">
                    Salary Due
                </th>

                <th class="num">
                    Salary Paid
                </th>

                <th class="num">
                    Pending
                </th>

                <th class="num">
                    Previous Pending
                </th>

                <th>
                    Status
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
                        row =>
                            `

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
                                        row.payroll.salary
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.food
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.salaryDue
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.salaryPaid
                                    )}
                                </td>

                                <td class="num">
                                    <b>
                                        ${money(
                                            row.payroll.pending
                                        )}
                                    </b>
                                </td>

                                <td class="num">

                                    ${
                                        row.previousPending > 0

                                            ?

                                        money(
                                            row.previousPending
                                        )

                                            :

                                        "-"
                                    }

                                </td>

                                <td>
                                    ${statusHTML(
                                        row.payroll.status
                                    )}
                                </td>

                                <td>

                                    ${
                                        row.payroll.leaveDays
                                            ? `${row.payroll.leaveDays} day(s)`
                                            : "-"
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
                            No employees found.
                        </td>

                    </tr>
                `
            }

        </tbody>
    `;
}


/* =====================================================
   PRINT WINDOW
===================================================== */

function openPayrollPrintWindow(
    title,
    month,
    table,
    summary = ""
) {

    const monthName =
        formatMonthName(
            month
        );


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "Please allow pop-ups to print the report."
        );

        return;
    }


    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <meta charset="UTF-8">

            <title>
                ${escapeHTML(
                    title
                )}
            </title>


            <style>

                * {
                    box-sizing:border-box;
                }

                body {
                    font-family:Arial,sans-serif;
                    margin:30px;
                    color:#111;
                }

                .header {
                    text-align:center;
                    margin-bottom:20px;
                }

                .header h1 {
                    margin:0;
                    font-size:24px;
                }

                .header h2 {
                    margin:8px 0;
                    font-size:20px;
                }

                .header p {
                    margin:4px 0;
                    font-size:13px;
                }

                table {
                    width:100%;
                    border-collapse:collapse;
                    margin-top:20px;
                }

                th,
                td {
                    border:1px solid #000;
                    padding:8px;
                    font-size:12px;
                    text-align:left;
                }

                th {
                    font-weight:bold;
                }

                .num {
                    text-align:right;
                    white-space:nowrap;
                }

                .summary {
                    margin-top:20px;
                    font-size:14px;
                }

                .footer {
                    margin-top:30px;
                    display:flex;
                    justify-content:space-between;
                    font-size:12px;
                }

                @media print {

                    body {
                        margin:10mm;
                    }

                    .no-print {
                        display:none;
                    }

                }

            </style>

        </head>


        <body>

            <div class="header">

                <h1>
                    AL JEFOON TENTS
                </h1>

                <h2>
                    ${escapeHTML(
                        title
                    )}
                </h2>

                <p>
                    Month:
                    <b>
                        ${escapeHTML(
                            monthName
                        )}
                    </b>
                </p>

                <p>
                    Printed:
                    ${new Date().toLocaleString(
                        "en-AE"
                    )}
                </p>

            </div>


            ${summary}


            ${table}


            <div class="footer">

                <span>
                    Prepared by:
                    __________________
                </span>

                <span>
                    Approved by:
                    __________________
                </span>

            </div>


            <script>

                window.onload = function() {

                    window.print();

                };

            <\/script>

        </body>

        </html>

    `);


    printWindow.document.close();
}


/* =====================================================
   MONTH NAME
===================================================== */

function formatMonthName(
    month
) {

    if (!month) {
        return "";
    }


    const parts =
        month
            .split("-")
            .map(Number);


    const date =
        new Date(
            parts[0],
            parts[1] - 1,
            1
        );


    return date.toLocaleDateString(
        "en-US",
        {
            month:
                "long",

            year:
                "numeric"
        }
    );
}


/* =====================================================
   PRINT SELECTED REPORT
===================================================== */

function printSelectedReport() {

    const month =
        $("reportMonth")?.value ||
        currentMonth();


    const type =
        $("printReportType")?.value ||
        "full";


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


    let title =
        "Monthly Payroll Report";


    let table = "";


    let selectedRows =
        rows;


    /* =================================================
       PENDING SALARIES
    ================================================= */

    if (
        type ===
        "pending"
    ) {

        title =
            "Pending Salaries";


        selectedRows =
            rows.filter(
                row =>
                    row.payroll.status ===
                    "PENDING"
            );
    }


    /* =================================================
       PARTIALLY PAID
    ================================================= */

    else if (
        type ===
        "partial"
    ) {

        title =
            "Partially Paid Salaries";


        selectedRows =
            rows.filter(
                row =>
                    row.payroll.status ===
                    "PARTIALLY PAID"
            );
    }


    /* =================================================
       FULLY PAID
    ================================================= */

    else if (
        type ===
        "paid"
    ) {

        title =
            "Fully Paid Salaries";


        selectedRows =
            rows.filter(
                row =>
                    row.payroll.status ===
                    "FULLY PAID"
            );
    }


    /* =================================================
       STAFF ON LEAVE
    ================================================= */

    else if (
        type ===
        "leave"
    ) {

        title =
            "Staff On Leave";


        selectedRows =
            rows.filter(
                row =>
                    row.payroll.status ===
                    "ON LEAVE"
            );
    }


    /* =================================================
       PREVIOUS PENDING
    ================================================= */

    else if (
        type ===
        "previous_pending"
    ) {

        title =
            "Previous Salary Pending";


        selectedRows =
            state.employees
                .map(
                    employee => ({

                        employee,

                        pending:
                            getPreviousPendingSalary(
                                employee,
                                month
                            )
                    })
                )
                .filter(
                    row =>
                        row.pending > 0
                );
    }


    /* =================================================
       SALARY PAYMENTS
    ================================================= */

    else if (
        type ===
            "salary_payments" ||

        type ===
            "advances" ||

        type ===
            "loans"
    ) {

        let txType;


        if (
            type ===
            "salary_payments"
        ) {

            txType =
                "salary";

            title =
                "Salary Payments";

        } else if (
            type ===
            "advances"
        ) {

            txType =
                "advance";

            title =
                "Salary Advances";

        } else {

            txType =
                "loan_repayment";

            title =
                "Loan Repayments";
        }


        const transactions =
            state.transactions
                .filter(
                    transaction =>

                        transaction.type ===
                        txType &&

                        monthKey(
                            transaction.date
                        ) === month
                )
                .sort(
                    (
                        a,
                        b
                    ) =>
                        new Date(
                            b.date
                        ) -
                        new Date(
                            a.date
                        )
                );


        const total =
            transactions.reduce(
                (
                    sum,
                    transaction
                ) =>
                    sum +
                    Number(
                        transaction.amount || 0
                    ),
                0
            );


        table = `

            <table>

                <thead>

                    <tr>

                        <th>
                            Date
                        </th>

                        <th>
                            Employee ID
                        </th>

                        <th>
                            Employee
                        </th>

                        <th class="num">
                            Amount
                        </th>

                        <th>
                            Notes
                        </th>

                    </tr>

                </thead>


                <tbody>

                    ${
                        transactions.length

                            ?

                        transactions
                            .map(
                                transaction =>
                                    `

                                    <tr>

                                        <td>
                                            ${escapeHTML(
                                                transaction.date ||
                                                ""
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                transaction.employeeId ||
                                                ""
                                            )}
                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                employeeName(
                                                    transaction.employeeId
                                                )
                                            )}
                                        </td>

                                        <td class="num">

                                            <b>
                                                ${money(
                                                    transaction.amount
                                                )}
                                            </b>

                                        </td>

                                        <td>
                                            ${escapeHTML(
                                                transaction.notes ||
                                                transaction.note ||
                                                ""
                                            )}
                                        </td>

                                    </tr>

                                    `
                            )
                            .join("")

                            :

                        `
                            <tr>

                                <td
                                    colspan="5"
                                    class="empty"
                                >
                                    No records found for this month.
                                </td>

                            </tr>
                        `
                    }

                </tbody>

            </table>
        `;


        return openPayrollPrintWindow(

            title,

            month,

            table,

            `
                <div class="summary">

                    <b>
                        Total:
                        ${money(
                            total
                        )}
                    </b>

                </div>
            `
        );
    }


    /* =================================================
       STANDARD PAYROLL REPORTS
    ================================================= */

    const totalSalary =
        selectedRows.reduce(
            (
                total,
                row
            ) =>
                total +
                Number(
                    row.payroll.salaryDue ||
                    0
                ),
            0
        );


    const totalFood =
        selectedRows.reduce(
            (
                total,
                row
            ) =>
                total +
                Number(
                    row.payroll.food ||
                    0
                ),
            0
        );


    const totalPaid =
        selectedRows.reduce(
            (
                total,
                row
            ) =>
                total +
                Number(
                    row.payroll.salaryPaid ||
                    0
                ),
            0
        );


    const totalPending =
        selectedRows.reduce(
            (
                total,
                row
            ) =>
                total +
                Number(
                    row.payroll.pending ||
                    0
                ),
            0
        );


    table = `

        <table>

            <thead>

                <tr>

                    <th>
                        Employee ID
                    </th>

                    <th>
                        Employee
                    </th>

                    <th class="num">
                        Basic Salary
                    </th>

                    <th class="num">
                        Food Allowance
                    </th>

                    <th class="num">
                        Salary Due
                    </th>

                    <th class="num">
                        Salary Paid
                    </th>

                    <th class="num">
                        Pending Salary
                    </th>

                    <th>
                        Status
                    </th>

                    <th>
                        Leave
                    </th>

                </tr>

            </thead>


            <tbody>

                ${
                    selectedRows.length

                        ?

                    selectedRows
                        .map(
                            row =>
                                `

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
                                            row.payroll.salary
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            row.payroll.food
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            row.payroll.salaryDue
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            row.payroll.salaryPaid
                                        )}
                                    </td>

                                    <td class="num">

                                        <b>
                                            ${money(
                                                row.payroll.pending
                                            )}
                                        </b>

                                    </td>

                                    <td>
                                        ${row.payroll.status}
                                    </td>

                                    <td>
                                        ${
                                            row.payroll.leaveDays
                                                ? `${row.payroll.leaveDays} day(s)`
                                                : "-"
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
                                colspan="9"
                                class="empty"
                            >
                                No records found for this report.
                            </td>

                        </tr>
                    `
                }

            </tbody>

        </table>
    `;


    return openPayrollPrintWindow(

        title,

        month,

        table,

        `
            <div class="summary">

                <b>
                    Salary Due:
                    ${money(
                        totalSalary
                    )}
                </b>

                &nbsp;&nbsp;&nbsp;

                <b>
                    Food Allowance:
                    ${money(
                        totalFood
                    )}
                </b>

                &nbsp;&nbsp;&nbsp;

                <b>
                    Paid:
                    ${money(
                        totalPaid
                    )}
                </b>

                &nbsp;&nbsp;&nbsp;

                <b>
                    Pending:
                    ${money(
                        totalPending
                    )}
                </b>

            </div>
        `
    );
}


/* =====================================================
   RENDER EVERYTHING
===================================================== */

function renderAll() {

    populateEmployeeSelects();

    populateLeaveEmployeeSelect();

    renderDashboard();

    renderEmployees();

    renderTransactions();

    renderLeave();

    renderReport();
}


/* =====================================================
   LEAVE EMPLOYEE DROPDOWN
===================================================== */

function populateLeaveEmployeeSelect() {

    const select =
        $("leaveEmployee");

    if (!select) {
        return;
    }


    const currentValue =
        select.value;


    select.innerHTML = `

        <option value="">
            Select Employee
        </option>

        ${
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
                .join("")
        }

    `;


    select.value =
        currentValue;
}


/* =====================================================
   NAVIGATION
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        document
            .querySelectorAll(
                ".nav-btn"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        function() {

                            const section =
                                this.dataset.section;


                            document
                                .querySelectorAll(
                                    ".nav-btn"
                                )
                                .forEach(
                                    btn =>
                                        btn.classList
                                            .remove(
                                                "active"
                                            )
                                );


                            this.classList.add(
                                "active"
                            );


                            document
                                .querySelectorAll(
                                    ".section"
                                )
                                .forEach(
                                    sectionElement =>
                                        sectionElement
                                            .classList
                                            .remove(
                                                "active"
                                            )
                                );


                            const target =
                                $(
                                    section
                                );


                            if (
                                target
                            ) {

                                target.classList
                                    .add(
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


                                $("pageTitle")
                                    .textContent =
                                    titles[
                                        section
                                    ] ||
                                    this.textContent
                                        .trim();
                            }

                        }
                    );
                }
            );


        /* =================================================
           BUTTON EVENTS
        ================================================= */


        if (
            $("addEmployeeBtn")
        )
            $("addEmployeeBtn").onclick =
                addEmployee;


        if (
            $("addTransactionBtn")
        )
            $("addTransactionBtn").onclick =
                addTransaction;


        if (
            $("addLeaveBtn")
        )
            $("addLeaveBtn").onclick =
                addLeave;


        if (
            $("dashboardMonth")
        )
            $("dashboardMonth").onchange =
                renderAll;


        if (
            $("transactionMonth")
        )
            $("transactionMonth").onchange =
                renderTransactions;


        if (
            $("transactionEmployee")
        )
            $("transactionEmployee").onchange =
                renderTransactions;


        if (
            $("transactionType")
        )
            $("transactionType").onchange =
                renderTransactions;


        if (
            $("reportMonth")
        )
            $("reportMonth").onchange =
                renderReport;


        if (
            $("printReportBtn")
        )
            $("printReportBtn").onclick =
                printSelectedReport;


        if (
            $("quickAddBtn")
        ) {

            $("quickAddBtn").onclick =
                function() {

                    const button =
                        document.querySelector(
                            '[data-section="employees"]'
                        );

                    if (
                        button
                    ) {

                        button.click();
                    }
                };
        }


        if (
            $("dashboardReportBtn")
        ) {

            $("dashboardReportBtn")
                .onclick =
                function() {

                    const button =
                        document.querySelector(
                            '[data-section="reports"]'
                        );

                    if (
                        button
                    ) {

                        button.click();
                    }
                };
        }


        renderAll();
    }
);


/* =====================================================
   DIGITAL DATE / TIME
===================================================== */

function updateDigitalDateTime() {

    const element =
        $("dashboardDateTime");

    if (!element) {
        return;
    }


    const now =
        new Date();


    element.textContent =
        now.toLocaleDateString(
            "en-AE",
            {
                weekday:
                    "long",

                day:
                    "2-digit",

                month:
                    "long",

                year:
                    "numeric"
            }
        )
        +
        " • "
        +
        now.toLocaleTimeString(
            "en-AE",
            {
                hour:
                    "2-digit",

                minute:
                    "2-digit",

                second:
                    "2-digit"
            }
        );
}


setInterval(
    updateDigitalDateTime,
    1000
);


document.addEventListener(
    "DOMContentLoaded",
    updateDigitalDateTime
);


/* =====================================================
   GLOBAL ACCESS
===================================================== */

window.addEmployee =
    addEmployee;

window.editEmployee =
    editEmployee;

window.deleteEmployee =
    deleteEmployee;

window.addTransaction =
    addTransaction;

window.editTransaction =
    editTransaction;

window.deleteTransaction =
    deleteTransaction;

window.addLeave =
    addLeave;

window.editLeave =
    editLeave;

window.deleteLeave =
    deleteLeave;

window.printSelectedReport =
    printSelectedReport;

window.renderAll =
    renderAll;
