/* =====================================================
   PAYROLL PASSWORD PROTECTION
   ===================================================== */

const PAYROLL_PASSWORD = "ajt1978#";

function checkPayrollPassword() {
  const enteredPassword =
    document.getElementById("payrollPassword").value;

  if (enteredPassword === PAYROLL_PASSWORD) {
    document.getElementById("passwordScreen").style.display = "none";
    sessionStorage.setItem("payrollUnlocked", "true");
  } else {
    document.getElementById("passwordError").style.display = "block";
    document.getElementById("payrollPassword").value = "";
    document.getElementById("payrollPassword").focus();
  }
}

/* Automatically unlock during the current browser session */
document.addEventListener("DOMContentLoaded", function () {

  if (sessionStorage.getItem("payrollUnlocked") === "true") {
    document.getElementById("passwordScreen").style.display = "none";
  }

  document.getElementById("payrollPassword").addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      checkPayrollPassword();
    }
  });

});

/* =====================================================
   AL JEFOON TENTS
   PAYROLL SYSTEM
   SCRIPT.JS
   VERSION 2.7 + OVERPAYMENT

   FEATURES:
   - Employee IDs start at EMP003
   - Basic salary only used for salary calculations
   - Food allowance displayed separately
   - Food allowance editable
   - Salary / Advance / Loan editing
   - Leave editing
   - Leave dates optional
   - Leave days optional
   - Leave counter counts employees with leave records
   - Unpaid leave deducted from salary
   - Salary calculation can start from a selected date
   - Employees returning from vacation can be paid
     from their return/salary-start date
   - Partial salary payments supported
   - Remaining salary calculated automatically
   - Previous month pending salaries shown in reports
   - Previous month pending salaries shown on dashboard
   - Zero pending balances are not shown as pending
   - Monthly report print shows selected report month
   - Dark mode
   - OVERPAYMENT supported
===================================================== */


/* =====================================================
   STORAGE
===================================================== */

const STORAGE_KEY = "alJefoonPayrollV1";
const DARK_MODE_KEY = "alJefoonPayrollDarkMode";

/* Payroll records in this system begin from July 2026.
   Leave records dated before this month must not create
   previous salary pending balances. */
const PAYROLL_START_MONTH = "2026-07";


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


/*
   IMPORTANT:

   This helper is used only for displaying pending
   balances.

   Anything equal to zero or an extremely small
   floating-point remainder is treated as zero.
*/

function positiveBalance(value) {

    const amount =
        Number(value || 0);

    return amount > 0.009
        ? amount
        : 0;

}


function pendingMoney(value) {

    const amount =
        positiveBalance(value);

    return amount > 0
        ? money(amount)
        : "-";

}


function monthKey(date) {

    if (!date)
        return "";

    const d = new Date(
        String(date).length === 10
            ? `${date}T00:00:00`
            : date
    );

    if (isNaN(d.getTime()))
        return "";

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


function formatReportMonth(month) {

    if (!month) {
        return "";
    }

    const parts =
        String(month)
            .split("-")
            .map(Number);

    if (
        parts.length !== 2 ||
        isNaN(parts[0]) ||
        isNaN(parts[1])
    ) {
        return "";
    }

    const date =
        new Date(
            parts[0],
            parts[1] - 1,
            1
        );

    if (isNaN(date.getTime())) {
        return "";
    }

    return date.toLocaleString(
        "en-AE",
        {
            month: "long",
            year: "numeric"
        }
    );

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
   GET MONTHLY SALARY PAID
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
   GET SALARY CALCULATION START DATE

   IMPORTANT:

   The EARLIEST salaryStartDate in the selected
   month is used.

   This prevents a second salary payment entered
   later in the same month from accidentally moving
   the salary calculation start date forward.
===================================================== */

function getSalaryCalculationStartDate(
    employee,
    month
) {

    if (!employee) {

        return `${month}-01`;

    }

    const salaryTransactions =
        state.transactions
            .filter(
                transaction =>

                    transaction.employeeId ===
                    employee.id &&

                    transaction.type ===
                    "salary" &&

                    monthKey(
                        transaction.date
                    ) === month &&

                    transaction.salaryStartDate

            )
            .sort(
                (
                    a,
                    b
                ) =>

                    new Date(
                        a.salaryStartDate +
                        "T00:00:00"
                    ) -

                    new Date(
                        b.salaryStartDate +
                        "T00:00:00"
                    )
            );


    if (
        salaryTransactions.length
    ) {

        const date =
            salaryTransactions[0]
                .salaryStartDate;

        if (
            monthKey(date) === month
        ) {

            return date;

        }

    }


    return `${month}-01`;

}


/* =====================================================
   GET SALARY START DAY
===================================================== */

function getSalaryStartDay(
    employee,
    month,
    daysInMonth
) {

    const startDate =
        getSalaryCalculationStartDate(
            employee,
            month
        );


    const [year, monthNumber] =
        month.split("-").map(Number);


    const date =
        new Date(
            startDate +
            "T00:00:00"
        );


    if (
        isNaN(date.getTime()) ||
        date.getFullYear() !== year ||
        date.getMonth() !== monthNumber - 1
    ) {

        return 1;

    }


    return Math.min(
        Math.max(
            date.getDate(),
            1
        ),
        daysInMonth
    );

}


/* =====================================================
   CHECK EMPLOYEE ON FULL MONTH LEAVE
===================================================== */

function isEmployeeOnLeave(
    employee,
    month
) {

    if (!employee) {

        return false;

    }


    const [year, monthNumber] =
        month.split("-").map(Number);


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


    return state.leaves.some(
        leave => {

            if (
                leave.employeeId !==
                employee.id
            ) {

                return false;

            }


            /*
               No dates:
               retain original behaviour.
            */

            if (
                !leave.startDate &&
                !leave.endDate
            ) {

                return true;

            }


            /*
               Start date but no end date.
            */

            if (
                leave.startDate &&
                !leave.endDate
            ) {

                const start =
                    new Date(
                        leave.startDate +
                        "T00:00:00"
                    );

                return (
                    start <= monthStart
                );

            }


            /*
               End date but no start date.
            */

            if (
                !leave.startDate &&
                leave.endDate
            ) {

                const end =
                    new Date(
                        leave.endDate +
                        "T00:00:00"
                    );

                return (
                    end >= monthEnd
                );

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


            return (
                leaveStart <= monthStart &&
                leaveEnd >= monthEnd
            );

        }
    );

}


/* =====================================================
   CALCULATE UNPAID LEAVE DAYS
===================================================== */

function getLeaveDaysForMonth(
    employee,
    month,
    daysInMonth,
    salaryStartDay = 1
) {

    const [year, monthNumber] =
        month.split("-").map(Number);


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
       Salary calculation begins at the selected
       salary start day.
    */

    const salaryStart =
        new Date(
            year,
            monthNumber - 1,
            salaryStartDay
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

                /*
                   No dates.

                   Use manually entered number of days.
                */

                if (
                    !leave.startDate &&
                    !leave.endDate
                ) {

                    leaveDays +=
                        Number(
                            leave.days || 0
                        );

                    return;

                }


                /*
                   Start date but no end date.
                */

                if (
                    leave.startDate &&
                    !leave.endDate
                ) {

                    const leaveStart =
                        new Date(
                            leave.startDate +
                            "T00:00:00"
                        );


                    const actualStart =
                        leaveStart >
                        salaryStart
                            ? leaveStart
                            : salaryStart;


                    if (
                        actualStart >
                        monthEnd
                    ) {

                        return;

                    }


                    if (
                        Number(leave.days || 0) > 0
                    ) {

                        leaveDays +=
                            Number(
                                leave.days
                            );

                    } else {

                        const difference =
                            monthEnd.getTime() -
                            actualStart.getTime();


                        const actualDays =
                            Math.floor(
                                difference /
                                (1000 * 60 * 60 * 24)
                            ) + 1;


                        leaveDays +=
                            actualDays;

                    }

                    return;

                }


                /*
                   End date but no start date.
                */

                if (
                    !leave.startDate &&
                    leave.endDate
                ) {

                    const leaveEnd =
                        new Date(
                            leave.endDate +
                            "T00:00:00"
                        );


                    if (
                        leaveEnd <
                        salaryStart
                    ) {

                        return;

                    }


                    if (
                        Number(leave.days || 0) > 0
                    ) {

                        leaveDays +=
                            Number(
                                leave.days
                            );

                    } else {

                        const actualEnd =
                            leaveEnd <
                            monthEnd
                                ? leaveEnd
                                : monthEnd;


                        const difference =
                            actualEnd.getTime() -
                            salaryStart.getTime();


                        const actualDays =
                            Math.floor(
                                difference /
                                (1000 * 60 * 60 * 24)
                            ) + 1;


                        leaveDays +=
                            Math.max(
                                0,
                                actualDays
                            );

                    }

                    return;

                }


                /*
                   Both start and end dates exist.
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


                const actualStart =
                    [
                        leaveStart,
                        salaryStart,
                        monthStart
                    ].reduce(
                        (
                            latest,
                            date
                        ) =>
                            date > latest
                                ? date
                                : latest
                    );


                const actualEnd =
                    leaveEnd <
                    monthEnd
                        ? leaveEnd
                        : monthEnd;


                if (
                    actualStart >
                    actualEnd
                ) {

                    return;

                }


                if (
                    Number(leave.days || 0) > 0
                ) {

                    leaveDays +=
                        Number(
                            leave.days
                        );

                } else {

                    const difference =
                        actualEnd.getTime() -
                        actualStart.getTime();


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


    return Math.min(
        Math.max(
            leaveDays,
            0
        ),
        Math.max(
            0,
            daysInMonth -
            salaryStartDay +
            1
        )
    );

}


/* =====================================================
   MONTHLY TRANSACTION TOTAL
===================================================== */

function getMonthlyTransactionTotal(
    employee,
    month,
    type
) {

    return state.transactions
        .filter(
            transaction =>

                transaction.employeeId ===
                employee.id &&

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


    const [year, monthNumber] =
        month.split("-").map(Number);


    const daysInMonth =
        new Date(
            year,
            monthNumber,
            0
        ).getDate();


    /*
       Salary calculation start day.
    */

    const salaryStartDay =
        getSalaryStartDay(
            employee,
            month,
            daysInMonth
        );


    const salaryPeriodDays =
        Math.max(
            0,
            daysInMonth -
            salaryStartDay +
            1
        );


    /*
       Full-month leave.
    */

    const employeeOnFullLeave =
        isEmployeeOnLeave(
            employee,
            month
        );


    if (
        employeeOnFullLeave
    ) {

        return {

            salary:
                basicSalary,

            food:
                0,

            salaryDue:
                0,

            salaryPaid:
                0,

            pending:
                0,

            overpayment:
                0,

            status:
                "ON LEAVE",

            advances:
                getMonthlyTransactionTotal(
                    employee,
                    month,
                    "advance"
                ),

            loanRepayments:
                getMonthlyTransactionTotal(
                    employee,
                    month,
                    "loan_repayment"
                ),

            adjustments:
                getMonthlyTransactionTotal(
                    employee,
                    month,
                    "adjustment"
                ),

            leaveDays:
                daysInMonth,

            payableDays:
                0,

            salaryStartDate:
                `${month}-${String(
                    salaryStartDay
                ).padStart(2, "0")}`,

            salaryStartDay:
                salaryStartDay,

            salaryPeriodDays:
                0

        };

    }


    /*
       Calculate unpaid leave.
    */

    const leaveDays =
        getLeaveDaysForMonth(
            employee,
            month,
            daysInMonth,
            salaryStartDay
        );


    /*
       Number of days for which salary can actually
       be paid.
    */

    const payableDays =
        Math.max(
            0,
            salaryPeriodDays -
            leaveDays
        );


    /*
       Daily salary is based on the actual number
       of days in the selected month.
    */

    const dailySalary =
        daysInMonth > 0
            ? basicSalary / daysInMonth
            : 0;


    /*
       Salary due.
    */

    const salaryDue =
        Math.max(
            0,
            dailySalary *
            payableDays
        );


    /*
       Salary already paid.

       IMPORTANT:

       Do NOT cap salaryPaid at salaryDue.

       If the employee is paid more than the
       salary due, the full amount must remain
       visible so the system can calculate the
       overpayment.
    */

    const salaryPaidRaw =
        getMonthlySalaryPaid(
            employee,
            month
        );


    const salaryPaid =
        Math.max(
            0,
            salaryPaidRaw
        );


    /*
       Remaining salary.

       If the employee was paid more than the
       salary due, pending salary must be zero.
    */

    const pendingSalaryRaw =
        Math.max(
            0,
            salaryDue -
            salaryPaid
        );


    const pendingSalary =
        positiveBalance(
            pendingSalaryRaw
        );


    /*
       OVERPAYMENT

       Example:

       Salary due = AED 1,900
       Salary paid = AED 2,000

       Overpayment = AED 100
    */

    const overpaymentRaw =
        Math.max(
            0,
            salaryPaid -
            salaryDue
        );


    const overpayment =
        positiveBalance(
            overpaymentRaw
        );


    let status =
        "PENDING";


    if (
        salaryDue <= 0.009 &&
        salaryPaid > 0.009
    ) {

        status =
            "OVERPAID";

    } else if (
        overpayment > 0
    ) {

        status =
            "OVERPAID";

    } else if (
        salaryDue <= 0.009
    ) {

        status =
            "FULLY PAID";

    } else if (
        salaryPaid >=
        salaryDue - 0.009
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
        getMonthlyTransactionTotal(
            employee,
            month,
            "advance"
        );


    const loanRepayments =
        getMonthlyTransactionTotal(
            employee,
            month,
            "loan_repayment"
        );


    const adjustments =
        getMonthlyTransactionTotal(
            employee,
            month,
            "adjustment"
        );


    return {

        salary:
            basicSalary,

        food:
            foodAllowance,

        salaryDue:
            salaryDue,

        salaryPaid:
            salaryPaid,

        pending:
            pendingSalary,

        overpayment:
            overpayment,

        status,

        advances,

        loanRepayments,

        adjustments,

        leaveDays,

        payableDays,

        salaryStartDay,

        salaryPeriodDays,

        salaryStartDate:
            `${month}-${String(
                salaryStartDay
            ).padStart(2, "0")}`

    };

   ```javascript
/* =====================================================
   EMPLOYEE ID CONTINUED
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
   PREVIOUS MONTH
===================================================== */

function previousMonth(month) {

    const [year, monthNumber] =
        String(month)
            .split("-")
            .map(Number);

    if (
        !year ||
        !monthNumber
    ) {

        return "";

    }

    const date =
        new Date(
            year,
            monthNumber - 2,
            1
        );

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}`;

}


/* =====================================================
   DAYS IN MONTH
===================================================== */

function daysInMonth(month) {

    const [year, monthNumber] =
        String(month)
            .split("-")
            .map(Number);

    if (
        !year ||
        !monthNumber
    ) {

        return 0;

    }

    return new Date(
        year,
        monthNumber,
        0
    ).getDate();

}


/* =====================================================
   GET PREVIOUS MONTH PENDING SALARY
===================================================== */

function getPreviousMonthPending(
    employee,
    month
) {

    if (!employee) {

        return 0;

    }

    const previous =
        previousMonth(month);

    if (!previous) {

        return 0;

    }


    /*
       Payroll only starts from July 2026.

       Therefore June 2026 or earlier must never
       create an artificial pending salary.
    */

    if (
        previous <
        PAYROLL_START_MONTH
    ) {

        return 0;

    }


    const previousPayroll =
        payrollFor(
            employee,
            previous
        );


    return positiveBalance(
        previousPayroll.pending || 0
    );

}


/* =====================================================
   GET TOTAL PENDING INCLUDING PREVIOUS MONTH
===================================================== */

function getTotalPending(
    employee,
    month
) {

    if (!employee) {

        return 0;

    }

    const current =
        payrollFor(
            employee,
            month
        );


    const previous =
        getPreviousMonthPending(
            employee,
            month
        );


    return positiveBalance(
        current.pending +
        previous
    );

}


/* =====================================================
   GET LAST PENDING MONTH
===================================================== */

function getLastPendingMonth(
    employee,
    month
) {

    if (!employee) {

        return "";

    }


    let checkMonth =
        previousMonth(month);


    /*
       Check up to 24 previous months.

       This is intentionally limited so the payroll
       system does not become unnecessarily expensive.
    */

    for (
        let i = 0;
        i < 24;
        i++
    ) {

        if (
            !checkMonth ||
            checkMonth <
            PAYROLL_START_MONTH
        ) {

            break;

        }


        const payroll =
            payrollFor(
                employee,
                checkMonth
            );


        if (
            positiveBalance(
                payroll.pending
            ) > 0
        ) {

            return checkMonth;

        }


        checkMonth =
            previousMonth(
                checkMonth
            );

    }


    return "";

}


/* =====================================================
   EMPLOYEE FORM
===================================================== */

function employeeFormHTML(
    employee = null
) {

    const isEdit =
        !!employee;


    const name =
        employee
            ? employee.name || ""
            : "";


    const designation =
        employee
            ? employee.designation || ""
            : "";


    const salary =
        employee
            ? employee.salary || ""
            : "";


    const food =
        employee
            ? employee.food || ""
            : "";


    const joinDate =
        employee
            ? employee.joinDate || ""
            : "";


    return `

        <div class="form-grid">

            <div class="form-field full">

                <label>
                    Employee Name
                </label>

                <input
                    name="name"
                    required
                    value="${escapeHTML(name)}"
                    placeholder="Employee name"
                >

            </div>


            <div class="form-field">

                <label>
                    Designation
                </label>

                <input
                    name="designation"
                    value="${escapeHTML(designation)}"
                    placeholder="Designation"
                >

            </div>


            <div class="form-field">

                <label>
                    Joining Date
                </label>

                <input
                    name="joinDate"
                    type="date"
                    value="${escapeHTML(joinDate)}"
                >

            </div>


            <div class="form-field">

                <label>
                    Basic Salary
                </label>

                <input
                    name="salary"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value="${escapeHTML(salary)}"
                    placeholder="0.00"
                >

            </div>


            <div class="form-field">

                <label>
                    Food Allowance
                </label>

                <input
                    name="food"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${escapeHTML(food)}"
                    placeholder="0.00"
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
                    isEdit
                        ? "Save Changes"
                        : "Add Employee"
                }
            </button>

        </div>

    `;

}


/* =====================================================
   ADD EMPLOYEE
===================================================== */

function addEmployee() {

    openModal(
        "Add Employee",
        employeeFormHTML(),
        formData => {

            const name =
                String(
                    formData.get("name") || ""
                ).trim();


            if (!name) {

                alert(
                    "Please enter employee name."
                );

                return;

            }


            const salary =
                Number(
                    formData.get("salary") || 0
                );


            const food =
                Number(
                    formData.get("food") || 0
                );


            if (
                salary < 0 ||
                food < 0
            ) {

                alert(
                    "Salary and food allowance cannot be negative."
                );

                return;

            }


            state.employees.push({

                id:
                    getNextEmployeeID(),

                name,

                designation:
                    String(
                        formData.get(
                            "designation"
                        ) || ""
                    ).trim(),

                salary,

                food,

                joinDate:
                    formData.get(
                        "joinDate"
                    ) || "",

                active:
                    true

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


    if (!employee) {

        return;

    }


    openModal(
        "Edit Employee",
        employeeFormHTML(
            employee
        ),
        formData => {

            const name =
                String(
                    formData.get("name") || ""
                ).trim();


            if (!name) {

                alert(
                    "Please enter employee name."
                );

                return;

            }


            const salary =
                Number(
                    formData.get("salary") || 0
                );


            const food =
                Number(
                    formData.get("food") || 0
                );


            if (
                salary < 0 ||
                food < 0
            ) {

                alert(
                    "Salary and food allowance cannot be negative."
                );

                return;

            }


            employee.name =
                name;


            employee.designation =
                String(
                    formData.get(
                        "designation"
                    ) || ""
                ).trim();


            employee.salary =
                salary;


            employee.food =
                food;


            employee.joinDate =
                formData.get(
                    "joinDate"
                ) || "";


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


    if (!employee) {

        return;

    }


    const confirmed =
        confirm(
            `Delete ${employee.name}?`
        );


    if (!confirmed) {

        return;

    }


    state.employees =
        state.employees.filter(
            item =>
                item.id !== id
        );


    /*
       Keep transactions and leave records.

       This prevents accidental destruction of
       historical payroll records.
    */


    save();

    renderAll();

}


/* =====================================================
   TOGGLE EMPLOYEE STATUS
===================================================== */

function toggleEmployeeStatus(id) {

    const employee =
        getEmployee(id);


    if (!employee) {

        return;

    }


    employee.active =
        employee.active === false
            ? true
            : false;


    save();

    renderAll();

}


/* =====================================================
   EMPLOYEE OPTIONS
===================================================== */

function employeeOptions(
    selectedId = ""
) {

    return state.employees
        .map(
            employee => `

                <option
                    value="${escapeHTML(employee.id)}"
                    ${
                        employee.id ===
                        selectedId
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
   EMPLOYEE TABLE
===================================================== */

function renderEmployees() {

    const table =
        $("employeesTable");


    if (!table) {

        return;

    }


    if (
        !state.employees.length
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-state"
                >
                    No employees found.
                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        state.employees
            .map(
                employee => `

                    <tr>

                        <td>
                            ${escapeHTML(
                                employee.id
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                employee.name
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                employee.designation ||
                                "-"
                            )}
                        </td>

                        <td>
                            ${money(
                                employee.salary
                            )}
                        </td>

                        <td>
                            ${money(
                                employee.food
                            )}
                        </td>

                        <td>

                            <span
                                class="status-badge ${
                                    employee.active === false
                                        ? "inactive"
                                        : "active"
                                }"
                            >
                                ${
                                    employee.active === false
                                        ? "INACTIVE"
                                        : "ACTIVE"
                                }
                            </span>

                        </td>

                        <td>

                            <button
                                class="small-btn"
                                onclick="editEmployee('${escapeHTML(employee.id)}')"
                            >
                                Edit
                            </button>

                            <button
                                class="small-btn"
                                onclick="toggleEmployeeStatus('${escapeHTML(employee.id)}')"
                            >
                                ${
                                    employee.active === false
                                        ? "Activate"
                                        : "Deactivate"
                                }
                            </button>

                        </td>

                        <td>

                            <button
                                class="small-btn danger"
                                onclick="deleteEmployee('${escapeHTML(employee.id)}')"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>

                `
            )
            .join("");

}


/* =====================================================
   TRANSACTION TYPE LABEL
===================================================== */

function transactionTypeLabel(
    type
) {

    const labels = {

        salary:
            "Salary",

        advance:
            "Advance",

        loan:
            "Loan",

        loan_repayment:
            "Loan Repayment",

        adjustment:
            "Adjustment"

    };


    return (
        labels[type] ||
        type ||
        "-"
    );

}


/* =====================================================
   TRANSACTION FORM
===================================================== */

function transactionFormHTML(
    transaction = null
) {

    const isEdit =
        !!transaction;


    const employeeId =
        transaction
            ? transaction.employeeId
            : "";


    const type =
        transaction
            ? transaction.type
            : "salary";


    const amount =
        transaction
            ? transaction.amount
            : "";


    const date =
        transaction
            ? transaction.date
            : new Date()
                .toISOString()
                .slice(0, 10);


    const note =
        transaction
            ? transaction.note || ""
            : "";


    const salaryStartDate =
        transaction
            ? transaction.salaryStartDate || ""
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
                    <option value="">
                        Select Employee
                    </option>

                    ${employeeOptions(
                        employeeId
                    )}

                </select>

            </div>


            <div class="form-field">

                <label>
                    Transaction Type
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
                        Salary
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
                        Loan
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
                        Adjustment
                    </option>

                </select>

            </div>


            <div class="form-field">

                <label>
                    Amount
                </label>

                <input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value="${escapeHTML(amount)}"
                    placeholder="0.00"
                >

            </div>


            <div class="form-field">

                <label>
                    Date
                </label>

                <input
                    name="date"
                    type="date"
                    required
                    value="${escapeHTML(date)}"
                >

            </div>


            <div class="form-field">

                <label>
                    Salary Start Date
                    <span style="opacity:.6">
                        (Salary only)
                    </span>
                </label>

                <input
                    name="salaryStartDate"
                    type="date"
                    value="${escapeHTML(
                        salaryStartDate
                    )}"
                >

            </div>


            <div class="form-field full">

                <label>
                    Notes
                </label>

                <input
                    name="note"
                    value="${escapeHTML(note)}"
                    placeholder="Optional notes"
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
                    isEdit
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
        "Add Transaction",
        transactionFormHTML(),
        formData => {

            const employeeId =
                formData.get(
                    "employeeId"
                );


            if (!employeeId) {

                alert(
                    "Please select an employee."
                );

                return;

            }


            const amount =
                Number(
                    formData.get(
                        "amount"
                    ) || 0
                );


            if (
                amount <= 0
            ) {

                alert(
                    "Amount must be greater than zero."
                );

                return;

            }


            const type =
                formData.get(
                    "type"
                );


            const date =
                formData.get(
                    "date"
                );


            if (!date) {

                alert(
                    "Please select a date."
                );

                return;

            }


            let salaryStartDate =
                formData.get(
                    "salaryStartDate"
                ) || "";


            /*
               Salary start date is only meaningful
               for salary transactions.
            */

            if (
                type !== "salary"
            ) {

                salaryStartDate =
                    "";

            }


            /*
               If salary start date is empty,
               use transaction date.
            */

            if (
                type === "salary" &&
                !salaryStartDate
            ) {

                salaryStartDate =
                    date;

            }


            state.transactions.push({

                id:
                    generateID("TX"),

                employeeId,

                type,

                amount,

                date,

                salaryStartDate,

                note:
                    String(
                        formData.get(
                            "note"
                        ) || ""
                    ).trim()

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


    if (!transaction) {

        return;

    }


    openModal(
        "Edit Transaction",
        transactionFormHTML(
            transaction
        ),
        formData => {

            const employeeId =
                formData.get(
                    "employeeId"
                );


            if (!employeeId) {

                alert(
                    "Please select an employee."
                );

                return;

            }


            const amount =
                Number(
                    formData.get(
                        "amount"
                    ) || 0
                );


            if (
                amount <= 0
            ) {

                alert(
                    "Amount must be greater than zero."
                );

                return;

            }


            const type =
                formData.get(
                    "type"
                );


            const date =
                formData.get(
                    "date"
                );


            if (!date) {

                alert(
                    "Please select a date."
                );

                return;

            }


            let salaryStartDate =
                formData.get(
                    "salaryStartDate"
                ) || "";


            if (
                type !== "salary"
            ) {

                salaryStartDate =
                    "";

            }


            if (
                type === "salary" &&
                !salaryStartDate
            ) {

                salaryStartDate =
                    date;

            }


            transaction.employeeId =
                employeeId;


            transaction.type =
                type;


            transaction.amount =
                amount;


            transaction.date =
                date;


            transaction.salaryStartDate =
                salaryStartDate;


            transaction.note =
                String(
                    formData.get(
                        "note"
                    ) || ""
                ).trim();


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

    const transaction =
        state.transactions.find(
            item =>
                item.id === id
        );


    if (!transaction) {

        return;

    }


    if (
        !confirm(
            "Delete this transaction?"
        )
    ) {

        return;

    }


    state.transactions =
        state.transactions.filter(
            item =>
                item.id !== id
        );


    save();

    renderAll();

}


/* =====================================================
   TRANSACTION MONTH FILTER
===================================================== */

function getSelectedTransactionMonth() {

    if (
        $("transactionMonth") &&
        $("transactionMonth").value
    ) {

        return $("transactionMonth").value;

    }


    return currentMonth();

}


/* =====================================================
   TRANSACTION RENDERING
===================================================== */

function renderTransactions() {

    const table =
        $("transactionsTable");


    if (!table) {

        return;

    }


    const selectedMonth =
        getSelectedTransactionMonth();


    const employeeFilter =
        $("transactionEmployee")
            ? $("transactionEmployee").value
            : "";


    const typeFilter =
        $("transactionType")
            ? $("transactionType").value
            : "";


    let transactions =
        state.transactions.filter(
            transaction => {

                if (
                    selectedMonth &&
                    monthKey(
                        transaction.date
                    ) !== selectedMonth
                ) {

                    return false;

                }


                if (
                    employeeFilter &&
                    transaction.employeeId !==
                    employeeFilter
                ) {

                    return false;

                }


                if (
                    typeFilter &&
                    transaction.type !==
                    typeFilter
                ) {

                    return false;

                }


                return true;

            }
        );


    transactions =
        transactions.sort(
            (
                a,
                b
            ) => {

                const dateA =
                    new Date(
                        a.date +
                        "T00:00:00"
                    );

                const dateB =
                    new Date(
                        b.date +
                        "T00:00:00"
                    );


                return (
                    dateB -
                    dateA
                );

            }
        );


    if (
        !transactions.length
    ) {

        table.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    class="empty-state"
                >
                    No transactions found.
                </td>

            </tr>

        `;

        return;

    }


    table.innerHTML =
        transactions
            .map(
                transaction => `

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
                                transactionTypeLabel(
                                    transaction.type
                                )
                            )}
                        </td>

                        <td>
                            ${money(
                                transaction.amount
                            )}
                        </td>

                        <td>
                            ${escapeHTML(
                                transaction.note ||
                                "-"
                            )}
                        </td>

                        <td>

                            <button
                                class="small-btn"
                                onclick="editTransaction('${escapeHTML(transaction.id)}')"
                            >
                                Edit
                            </button>

                            <button
                                class="small-btn danger"
                                onclick="deleteTransaction('${escapeHTML(transaction.id)}')"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>

                `
            )
            .join("");

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
                positiveBalance(
                    row.payroll.pending
                ),

            0
        );


    const totalOverpayment =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                positiveBalance(
                    row.payroll.overpayment
                ),

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


    const overpaid =
        rows.filter(
            row =>
                row.payroll.status ===
                "OVERPAID"
        ).length;


    const reportTable =
        $("reportTable");


    if (!reportTable)
        return;


    reportTable.innerHTML = `

        <thead>

            <tr>

                <th>ID</th>

                <th>Employee</th>

                <th>Basic Salary</th>

                <th>Food</th>

                <th>Salary Due</th>

                <th>Salary Paid</th>

                <th>Pending</th>

                <th>Overpayment</th>

                <th>Status</th>

            </tr>

        </thead>

        <tbody>

            ${
                rows.length
                    ?
                rows
                    .map(
                        row => {

                            const p =
                                row.payroll;

                            return `

                                <tr>

                                    <td>
                                        ${escapeHTML(
                                            row.employee.id
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            row.employee.name
                                        )}
                                    </td>

                                    <td>
                                        ${money(
                                            row.employee.basicSalary
                                        )}
                                    </td>

                                    <td>
                                        ${money(
                                            p.food
                                        )}
                                    </td>

                                    <td>
                                        ${money(
                                            p.salaryDue
                                        )}
                                    </td>

                                    <td>
                                        ${money(
                                            p.salaryPaid
                                        )}
                                    </td>

                                    <td>
                                        ${money(
                                            positiveBalance(
                                                p.pending
                                            )
                                        )}
                                    </td>

                                    <td>
                                        ${money(
                                            positiveBalance(
                                                p.overpayment
                                            )
                                        )}
                                    </td>

                                    <td>

                                        ${
                                            p.status ===
                                            "OVERPAID"

                                                ?

                                            `<span
                                                class="status-badge"
                                            >
                                                OVERPAID
                                            </span>`

                                                :

                                            escapeHTML(
                                                p.status
                                            )
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
                            No employees found.
                        </td>

                    </tr>
                `
            }

        </tbody>

        <tfoot>

            <tr>

                <th colspan="2">
                    TOTAL
                </th>

                <th>
                    ${money(
                        totalSalaries
                    )}
                </th>

                <th>
                    ${money(
                        totalFood
                    )}
                </th>

                <th>
                    ${money(
                        totalSalaries
                    )}
                </th>

                <th>
                    ${money(
                        totalPaid
                    )}
                </th>

                <th>
                    ${money(
                        totalPending
                    )}
                </th>

                <th>
                    ${money(
                        totalOverpayment
                    )}
                </th>

                <th>
                    ${overpaid}
                    Overpaid
                </th>

            </tr>

        </tfoot>

    `;


    const totalSalaryEl =
        $("reportTotalSalary");

    if (totalSalaryEl)
        totalSalaryEl.textContent =
            money(totalSalaries);


    const totalFoodEl =
        $("reportTotalFood");

    if (totalFoodEl)
        totalFoodEl.textContent =
            money(totalFood);


    const totalPaidEl =
        $("reportTotalPaid");

    if (totalPaidEl)
        totalPaidEl.textContent =
            money(totalPaid);


    const totalPendingEl =
        $("reportTotalPending");

    if (totalPendingEl)
        totalPendingEl.textContent =
            money(totalPending);


    const totalOverpaymentEl =
        $("reportTotalOverpayment");

    if (totalOverpaymentEl)
        totalOverpaymentEl.textContent =
            money(totalOverpayment);


    const reportSummary =
        $("reportSummary");

    if (reportSummary) {

        reportSummary.innerHTML = `

            <div class="summary-item">

                <span>
                    Total Employees
                </span>

                <strong>
                    ${rows.length}
                </strong>

            </div>

            <div class="summary-item">

                <span>
                    Fully Paid
                </span>

                <strong>
                    ${fullyPaid}
                </strong>

            </div>

            <div class="summary-item">

                <span>
                    Partially Paid
                </span>

                <strong>
                    ${partiallyPaid}
                </strong>

            </div>

            <div class="summary-item">

                <span>
                    Overpaid
                </span>

                <strong>
                    ${overpaid}
                </strong>

            </div>

            <div class="summary-item">

                <span>
                    Pending Salary
                </span>

                <strong>
                    ${money(
                        totalPending
                    )}
                </strong>

            </div>

            <div class="summary-item">

                <span>
                    Total Overpayment
                </span>

                <strong>
                    ${money(
                        totalOverpayment
                    )}
                </strong>

            </div>

        `;

    }

}

/* =====================================================
   DASHBOARD
===================================================== */

function renderDashboard() {

    const month =
        $("reportMonth")?.value ||
        currentMonth();

    const rows =
        state.employees.map(
            employee => ({
                employee,
                payroll: payrollFor(
                    employee,
                    month
                )
            })
        );


    const totalEmployees =
        rows.length;


    const activeEmployees =
        rows.filter(
            row =>
                row.employee.active !== false
        ).length;


    const totalSalary =
        rows.reduce(
            (sum, row) =>
                sum +
                row.payroll.salaryDue,
            0
        );


    const totalPaid =
        rows.reduce(
            (sum, row) =>
                sum +
                row.payroll.salaryPaid,
            0
        );


    const totalPending =
        rows.reduce(
            (sum, row) =>
                sum +
                positiveBalance(
                    row.payroll.pending
                ),
            0
        );


    const totalOverpayment =
        rows.reduce(
            (sum, row) =>
                sum +
                positiveBalance(
                    row.payroll.overpayment
                ),
            0
        );


    const paidCount =
        rows.filter(
            row =>
                row.payroll.status ===
                "FULLY PAID"
        ).length;


    const pendingCount =
        rows.filter(
            row =>
                row.payroll.pending > 0
        ).length;


    const overpaidCount =
        rows.filter(
            row =>
                row.payroll.overpayment > 0
        ).length;


    const values = {

        totalEmployees,

        activeEmployees,

        totalSalary,

        totalPaid,

        totalPending,

        totalOverpayment,

        paidCount,

        pendingCount,

        overpaidCount

    };


    const mappings = {

        totalEmployees: [
            "totalEmployees",
            "dashboardTotalEmployees"
        ],

        activeEmployees: [
            "activeEmployees",
            "dashboardActiveEmployees"
        ],

        totalSalary: [
            "totalSalary",
            "dashboardTotalSalary"
        ],

        totalPaid: [
            "totalPaid",
            "dashboardTotalPaid"
        ],

        totalPending: [
            "totalPending",
            "dashboardTotalPending"
        ],

        totalOverpayment: [
            "totalOverpayment",
            "dashboardTotalOverpayment"
        ],

        paidCount: [
            "paidCount",
            "dashboardPaidCount"
        ],

        pendingCount: [
            "pendingCount",
            "dashboardPendingCount"
        ],

        overpaidCount: [
            "overpaidCount",
            "dashboardOverpaidCount"
        ]

    };


    Object.keys(
        mappings
    ).forEach(
        key => {

            mappings[key]
                .forEach(
                    id => {

                        const element =
                            $(id);

                        if (!element)
                            return;


                        const value =
                            values[key];


                        element.textContent =
                            typeof value ===
                            "number" &&
                            [
                                "totalSalary",
                                "totalPaid",
                                "totalPending",
                                "totalOverpayment"
                            ].includes(key)

                                ?

                            money(value)

                                :

                            value;

                    }
                );

        }
    );


    const dashboardMonth =
        $("dashboardMonth");

    if (dashboardMonth)
        dashboardMonth.value =
            month;


    const overpaymentBox =
        $("dashboardOverpayment");


    if (overpaymentBox) {

        overpaymentBox.innerHTML = `

            <div class="dashboard-card">

                <div class="dashboard-card-title">
                    Overpayment
                </div>

                <div class="dashboard-card-value">
                    ${money(
                        totalOverpayment
                    )}
                </div>

                <div class="dashboard-card-subtitle">
                    ${overpaidCount}
                    employee${
                        overpaidCount === 1
                            ? ""
                            : "s"
                    }
                    overpaid
                </div>

            </div>

        `;

    }

}


/* =====================================================
   LEAVE MANAGEMENT
===================================================== */

function leaveFormHTML(
    leave = null
) {

    const employeeId =
        leave?.employeeId || "";


    const startDate =
        leave?.startDate || "";


    const endDate =
        leave?.endDate || "";


    const days =
        leave?.days || "";


    const reason =
        leave?.reason || "";


    return `

        <div class="form-grid">

            <div class="form-group">

                <label>
                    Employee
                </label>

                <select
                    id="leaveEmployee"
                >

                    <option value="">
                        Select Employee
                    </option>

                    ${employeeOptions(
                        employeeId
                    )}

                </select>

            </div>


            <div class="form-group">

                <label>
                    Start Date
                </label>

                <input
                    type="date"
                    id="leaveStartDate"
                    value="${escapeHTML(
                        startDate
                    )}"
                >

            </div>


            <div class="form-group">

                <label>
                    End Date
                </label>

                <input
                    type="date"
                    id="leaveEndDate"
                    value="${escapeHTML(
                        endDate
                    )}"
                >

            </div>


            <div class="form-group">

                <label>
                    Days
                </label>

                <input
                    type="number"
                    id="leaveDays"
                    min="0"
                    step="1"
                    value="${escapeHTML(
                        days
                    )}"
                >

            </div>


            <div
                class="form-group"
                style="grid-column:1/-1"
            >

                <label>
                    Reason
                </label>

                <input
                    type="text"
                    id="leaveReason"
                    value="${escapeHTML(
                        reason
                    )}"
                    placeholder="Reason"
                >

            </div>

        </div>

    `;

}


function addLeave() {

    const employeeId =
        $("leaveEmployee")?.value;


    const startDate =
        $("leaveStartDate")?.value;


    const endDate =
        $("leaveEndDate")?.value;


    const daysInput =
        $("leaveDays")?.value;


    const reason =
        $("leaveReason")?.value
        || "";


    if (!employeeId) {

        alert(
            "Please select an employee."
        );

        return;

    }


    if (!startDate) {

        alert(
            "Please select a start date."
        );

        return;

    }


    let days =
        Number(daysInput);


    if (
        !days &&
        endDate
    ) {

        const start =
            new Date(
                startDate
            );

        const end =
            new Date(
                endDate
            );


        days =
            Math.floor(
                (
                    end -
                    start
                ) /
                86400000
            ) + 1;

    }


    if (!days)
        days = 1;


    state.leaves.push({

        id:
            "L" +
            Date.now(),

        employeeId,

        startDate,

        endDate,

        days,

        reason

    });


    saveState();

    renderAll();

    closeModal();

}


function editLeave(
    id
) {

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
        `
            <button
                class="btn"
                onclick="updateLeave('${id}')"
            >
                Save Changes
            </button>

            <button
                class="btn secondary"
                onclick="closeModal()"
            >
                Cancel
            </button>
        `
    );

}


function updateLeave(
    id
) {

    const leave =
        state.leaves.find(
            item =>
                item.id === id
        );


    if (!leave)
        return;


    const employeeId =
        $("leaveEmployee")?.value;


    const startDate =
        $("leaveStartDate")?.value;


    const endDate =
        $("leaveEndDate")?.value;


    let days =
        Number(
            $("leaveDays")?.value
        );


    const reason =
        $("leaveReason")?.value
        || "";


    if (!employeeId ||
        !startDate) {

        alert(
            "Please select the employee and start date."
        );

        return;

    }


    if (
        !days &&
        endDate
    ) {

        const start =
            new Date(
                startDate
            );

        const end =
            new Date(
                endDate
            );


        days =
            Math.floor(
                (
                    end -
                    start
                ) /
                86400000
            ) + 1;

    }


    if (!days)
        days = 1;


    leave.employeeId =
        employeeId;

    leave.startDate =
        startDate;

    leave.endDate =
        endDate;

    leave.days =
        days;

    leave.reason =
        reason;


    saveState();

    renderAll();

    closeModal();

}


function deleteLeave(
    id
) {

    const leave =
        state.leaves.find(
            item =>
                item.id === id
        );


    if (!leave)
        return;


    if (
        !confirm(
            "Delete this leave record?"
        )
    )
        return;


    state.leaves =
        state.leaves.filter(
            item =>
                item.id !== id
        );


    saveState();

    renderAll();

}


/* =====================================================
   MODAL
===================================================== */

function openModal(
    title,
    content,
    footer = ""
) {

    const modal =
        $("modal");


    if (!modal)
        return;


    const modalTitle =
        $("modalTitle");


    const modalBody =
        $("modalBody");


    const modalFooter =
        $("modalFooter");


    if (modalTitle)
        modalTitle.textContent =
            title;


    if (modalBody)
        modalBody.innerHTML =
            content;


    if (modalFooter)
        modalFooter.innerHTML =
            footer;


    modal.classList.add(
        "show"
    );


    modal.style.display =
        "flex";

}


function closeModal() {

    const modal =
        $("modal");


    if (!modal)
        return;


    modal.classList.remove(
        "show"
    );


    modal.style.display =
        "none";

}


/* =====================================================
   SAVE STATE
===================================================== */

function saveState() {

    try {

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
                state
            )
        );

    } catch (error) {

        console.error(
            "Unable to save payroll data:",
            error
        );

    }

}


/* =====================================================
   LOAD STATE
===================================================== */

function loadState() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );


        if (!saved)
            return;


        const parsed =
            JSON.parse(
                saved
            );


        if (
            parsed &&
            typeof parsed ===
            "object"
        ) {

            state =
                Object.assign(
                    {
                        employees: [],
                        transactions: [],
                        leaves: []
                    },
                    parsed
                );

        }


        if (
            !Array.isArray(
                state.employees
            )
        )
            state.employees = [];


        if (
            !Array.isArray(
                state.transactions
            )
        )
            state.transactions = [];


        if (
            !Array.isArray(
                state.leaves
            )
        )
            state.leaves = [];


    } catch (error) {

        console.error(
            "Unable to load payroll data:",
            error
        );

    }

}


/* =====================================================
   RENDER EVERYTHING
===================================================== */

function renderAll() {

    renderEmployees();

    renderTransactions();

    renderLeave();

    renderReport();

    renderDashboard();

}


/* =====================================================
   DARK MODE
===================================================== */

function applyDarkMode() {

    const enabled =
        localStorage.getItem(
            DARK_MODE_KEY
        ) === "true";


    document.body.classList.toggle(
        "dark-mode",
        enabled
    );


    const toggle =
        $("darkModeToggle");


    if (toggle) {

        if (
            toggle.type ===
            "checkbox"
        ) {

            toggle.checked =
                enabled;

        }

    }

}


function toggleDarkMode() {

    const enabled =
        document.body.classList.contains(
            "dark-mode"
        );


    const newValue =
        !enabled;


    document.body.classList.toggle(
        "dark-mode",
        newValue
    );


    localStorage.setItem(
        DARK_MODE_KEY,
        String(
            newValue
        )
    );

}


/* =====================================================
   PRINT REPORT
===================================================== */

function printReport() {

    renderReport();


    document.body.classList.add(
        "printing-report"
    );


    window.print();


    setTimeout(
        () => {

            document.body.classList.remove(
                "printing-report"
            );

        },
        500
    );

}

/* =====================================================
   CONTINUE MONTHLY PAYROLL CALCULATION
===================================================== */

    const salaryDue =
        dailySalary *
        payableDays;


    /*
       Food allowance is calculated separately.

       Food allowance is also prorated according to
       the payable days.
    */

    const dailyFood =
        daysInMonth > 0
            ? foodAllowance / daysInMonth
            : 0;


    const foodDue =
        dailyFood *
        payableDays;


    /*
       Salary payments are NEVER capped at the salary
       due.

       This is important for overpayment.

       Example:

       Salary due = AED 1,900
       Salary paid = AED 2,000

       Pending      = AED 0
       Overpayment  = AED 100
    */

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


    const overpayment =
        Math.max(
            0,
            salaryPaid -
            salaryDue
        );


    let status =
        "PENDING";


    if (
        overpayment > 0
    ) {

        status =
            "OVERPAID";

    } else if (
        salaryPaid >= salaryDue &&
        salaryDue > 0
    ) {

        status =
            "FULLY PAID";

    } else if (
        salaryPaid > 0
    ) {

        status =
            "PARTIALLY PAID";

    }


    if (
        salaryDue <= 0
    ) {

        status =
            "ON LEAVE";

    }


    const advances =
        getMonthlyTransactionTotal(
            employee,
            month,
            "advance"
        );


    const loanRepayments =
        getMonthlyTransactionTotal(
            employee,
            month,
            "loan_repayment"
        );


    const adjustments =
        getMonthlyTransactionTotal(
            employee,
            month,
            "adjustment"
        );


    return {

        salary:
            basicSalary,

        food:
            foodDue,

        salaryDue,

        salaryPaid,

        pending:
            pendingSalary,

        overpayment,

        status,

        advances,

        loanRepayments,

        adjustments,

        leaveDays,

        payableDays,

        salaryStartDate:
            `${month}-${String(
                salaryStartDay
            ).padStart(
                2,
                "0"
            )}`,

        salaryStartDay,

        salaryPeriodDays

    };

}


/* =====================================================
   GET PREVIOUS MONTH
===================================================== */

function previousMonth(
    month
) {

    const [year, monthNumber] =
        month
            .split("-")
            .map(Number);


    const date =
        new Date(
            year,
            monthNumber - 2,
            1
        );


    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(
        2,
        "0"
    )}`;

}


/* =====================================================
   PREVIOUS MONTH PENDING
===================================================== */

function getPreviousMonthPending(
    employee,
    month
) {

    const previous =
        previousMonth(
            month
        );


    const previousPayroll =
        payrollFor(
            employee,
            previous
        );


    return positiveBalance(
        previousPayroll.pending
    );

}


/* =====================================================
   TOTAL PENDING
===================================================== */

function getTotalPending(
    employee
) {

    let total = 0;


    const current =
        currentMonth();


    let month =
        current;


    for (
        let i = 0;
        i < 60;
        i++
    ) {

        const payroll =
            payrollFor(
                employee,
                month
            );


        total +=
            positiveBalance(
                payroll.pending
            );


        month =
            previousMonth(
                month
            );

    }


    return total;

}


/* =====================================================
   LAST PENDING MONTH
===================================================== */

function getLastPendingMonth(
    employee,
    month
) {

    let checkMonth =
        previousMonth(
            month
        );


    for (
        let i = 0;
        i < 60;
        i++
    ) {

        const payroll =
            payrollFor(
                employee,
                checkMonth
            );


        if (
            payroll.pending > 0
        ) {

            return checkMonth;

        }


        checkMonth =
            previousMonth(
                checkMonth
            );

    }


    return null;

}


/* =====================================================
   EMPLOYEE PAYROLL SUMMARY
===================================================== */

function getEmployeePayrollSummary(
    employee,
    month
) {

    const payroll =
        payrollFor(
            employee,
            month
        );


    const previousPending =
        getPreviousMonthPending(
            employee,
            month
        );


    return {

        ...payroll,

        previousPending,

        totalPending:
            previousPending +
            positiveBalance(
                payroll.pending
            ),

        totalOverpayment:
            positiveBalance(
                payroll.overpayment
            )

    };

}

/* =====================================================
   EMPLOYEE FORM
===================================================== */

function employeeFormHTML(employee = null) {

    return `
        <div class="form-grid">

            <div class="form-group">
                <label>Employee Name</label>
                <input
                    type="text"
                    id="employeeName"
                    value="${escapeHTML(employee?.name || "")}"
                    placeholder="Employee name"
                >
            </div>

            <div class="form-group">
                <label>Basic Salary</label>
                <input
                    type="number"
                    id="employeeSalary"
                    min="0"
                    step="0.01"
                    value="${employee?.basicSalary ?? ""}"
                    placeholder="Basic salary"
                >
            </div>

            <div class="form-group">
                <label>Food Allowance</label>
                <input
                    type="number"
                    id="employeeFood"
                    min="0"
                    step="0.01"
                    value="${employee?.foodAllowance ?? 0}"
                    placeholder="Food allowance"
                >
            </div>

            <div class="form-group">
                <label>Salary Start Date</label>
                <input
                    type="date"
                    id="employeeStartDate"
                    value="${escapeHTML(
                        employee?.salaryStartDate || ""
                    )}"
                >
            </div>

        </div>
    `;
}


/* =====================================================
   ADD EMPLOYEE
===================================================== */

function addEmployee() {

    const name =
        $("employeeName")?.value.trim();

    const basicSalary =
        Number(
            $("employeeSalary")?.value || 0
        );

    const foodAllowance =
        Number(
            $("employeeFood")?.value || 0
        );

    const salaryStartDate =
        $("employeeStartDate")?.value || "";


    if (!name) {

        alert(
            "Please enter employee name."
        );

        return;
    }


    if (basicSalary < 0) {

        alert(
            "Basic salary cannot be negative."
        );

        return;
    }


    state.employees.push({

        id:
            getNextEmployeeID(),

        name,

        basicSalary,

        foodAllowance,

        salaryStartDate,

        active:
            true

    });


    saveState();

    renderAll();

    closeModal();

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
        employeeFormHTML(
            employee
        ),
        `
            <button
                class="btn"
                onclick="updateEmployee('${id}')"
            >
                Save Changes
            </button>

            <button
                class="btn secondary"
                onclick="closeModal()"
            >
                Cancel
            </button>
        `
    );

}


/* =====================================================
   UPDATE EMPLOYEE
===================================================== */

function updateEmployee(id) {

    const employee =
        getEmployee(id);


    if (!employee)
        return;


    const name =
        $("employeeName")?.value.trim();

    const basicSalary =
        Number(
            $("employeeSalary")?.value || 0
        );

    const foodAllowance =
        Number(
            $("employeeFood")?.value || 0
        );

    const salaryStartDate =
        $("employeeStartDate")?.value || "";


    if (!name) {

        alert(
            "Please enter employee name."
        );

        return;
    }


    if (basicSalary < 0) {

        alert(
            "Basic salary cannot be negative."
        );

        return;
    }


    employee.name =
        name;

    employee.basicSalary =
        basicSalary;

    employee.foodAllowance =
        foodAllowance;

    employee.salaryStartDate =
        salaryStartDate;


    saveState();

    renderAll();

    closeModal();

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
            `Delete ${employee.name}?`
        )
    )
        return;


    state.employees =
        state.employees.filter(
            employee =>
                employee.id !== id
        );


    /*
       Keep historical transactions and
       leave records intact.
       This prevents old payroll history
       from being destroyed accidentally.
    */

    saveState();

    renderAll();

}


/* =====================================================
   TOGGLE EMPLOYEE STATUS
===================================================== */

function toggleEmployeeStatus(id) {

    const employee =
        getEmployee(id);


    if (!employee)
        return;


    employee.active =
        employee.active === false;


    saveState();

    renderAll();

}


/* =====================================================
   EMPLOYEE OPTIONS
===================================================== */

function employeeOptions(
    selectedId = ""
) {

    return state.employees
        .map(
            employee => `

                <option
                    value="${escapeHTML(
                        employee.id
                    )}"
                    ${
                        employee.id === selectedId
                            ? "selected"
                            : ""
                    }
                >

                    ${escapeHTML(
                        employee.name
                    )}
                    -
                    ${escapeHTML(
                        employee.id
                    )}

                </option>

            `
        )
        .join("");

}


/* =====================================================
   TRANSACTION FORM
===================================================== */

function transactionFormHTML(
    transaction = null
) {

    const employeeId =
        transaction?.employeeId || "";

    const type =
        transaction?.type || "salary";

    const amount =
        transaction?.amount ?? "";

    const date =
        transaction?.date ||
        new Date()
            .toISOString()
            .slice(0, 10);

    const notes =
        transaction?.notes || "";


    return `

        <div class="form-grid">

            <div class="form-group">

                <label>
                    Employee
                </label>

                <select
                    id="transactionEmployee"
                >

                    <option value="">
                        Select Employee
                    </option>

                    ${employeeOptions(
                        employeeId
                    )}

                </select>

            </div>


            <div class="form-group">

                <label>
                    Transaction Type
                </label>

                <select
                    id="transactionType"
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
                        Loan
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
                        Adjustment
                    </option>

                </select>

            </div>


            <div class="form-group">

                <label>
                    Amount
                </label>

                <input
                    type="number"
                    id="transactionAmount"
                    min="0"
                    step="0.01"
                    value="${amount}"
                    placeholder="Amount"
                >

            </div>


            <div class="form-group">

                <label>
                    Date
                </label>

                <input
                    type="date"
                    id="transactionDate"
                    value="${escapeHTML(
                        date
                    )}"
                >

            </div>


            <div
                class="form-group"
                style="grid-column:1/-1"
            >

                <label>
                    Notes
                </label>

                <input
                    type="text"
                    id="transactionNotes"
                    value="${escapeHTML(
                        notes
                    )}"
                    placeholder="Notes"
                >

            </div>

        </div>

    `;

}


/* =====================================================
   ADD TRANSACTION
===================================================== */

function addTransaction() {

    const employeeId =
        $("transactionEmployee")?.value;

    const type =
        $("transactionType")?.value;

    const amount =
        Number(
            $("transactionAmount")?.value || 0
        );

    const date =
        $("transactionDate")?.value;

    const notes =
        $("transactionNotes")?.value || "";


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


    if (!date) {

        alert(
            "Please select a date."
        );

        return;
    }


    state.transactions.push({

        id:
            "T" +
            Date.now(),

        employeeId,

        type,

        amount,

        date,

        notes

    });


    saveState();

    renderAll();

    closeModal();

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
        "Edit Transaction",
        transactionFormHTML(
            transaction
        ),
        `
            <button
                class="btn"
                onclick="updateTransaction('${id}')"
            >
                Save Changes
            </button>

            <button
                class="btn secondary"
                onclick="closeModal()"
            >
                Cancel
            </button>
        `
    );

}

                /*
                   Both dates exist.
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


                const actualStart =
                    leaveStart >
                    salaryStart
                        ? leaveStart
                        : salaryStart;


                const actualEnd =
                    leaveEnd <
                    monthEnd
                        ? leaveEnd
                        : monthEnd;


                if (
                    actualStart >
                    actualEnd
                ) {

                    return;

                }


                if (
                    Number(
                        leave.days || 0
                    ) > 0
                ) {

                    leaveDays +=
                        Number(
                            leave.days
                        );

                } else {

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
                        Math.max(
                            0,
                            actualDays
                        );

                }

            }
        );


    return Math.min(
        Math.max(
            leaveDays,
            0
        ),
        Math.max(
            daysInMonth -
            salaryStartDay +
            1,
            0
        )
    );

}


/* =====================================================
   MONTHLY TRANSACTION TOTAL
===================================================== */

function getMonthlyTransactionTotal(
    employee,
    month,
    type
) {

    if (!employee)
        return 0;


    return state.transactions
        .filter(
            transaction =>

                transaction.employeeId ===
                employee.id &&

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
   PAYROLL CALCULATION
===================================================== */

function payrollFor(
    employee,
    month
) {

    if (!employee) {

        return {

            salary: 0,

            food: 0,

            salaryDue: 0,

            salaryPaid: 0,

            pending: 0,

            overpayment: 0,

            status: "PENDING",

            advances: 0,

            loanRepayments: 0,

            adjustments: 0,

            leaveDays: 0,

            payableDays: 0,

            salaryStartDate:
                `${month}-01`,

            salaryStartDay: 1,

            salaryPeriodDays: 0

        };

    }


    const [year, monthNumber] =
        month
            .split("-")
            .map(Number);


    const daysInMonth =
        new Date(
            year,
            monthNumber,
            0
        ).getDate();


    const basicSalary =
        Number(
            employee.basicSalary || 0
        );


    const foodAllowance =
        Number(
            employee.foodAllowance || 0
        );


    const salaryStartDate =
        getSalaryCalculationStartDate(
            employee,
            month
        );


    const salaryStartDay =
        getSalaryStartDay(
            employee,
            month,
            daysInMonth
        );


    const salaryPeriodDays =
        Math.max(
            daysInMonth -
            salaryStartDay +
            1,
            0
        );


    const leaveDays =
        getLeaveDaysForMonth(
            employee,
            month,
            daysInMonth,
            salaryStartDay
        );


    const payableDays =
        Math.max(
            salaryPeriodDays -
            leaveDays,
            0
        );


    const dailySalary =
        daysInMonth > 0
            ? basicSalary /
              daysInMonth
            : 0;


    const salaryDue =
        dailySalary *
        payableDays;


    const dailyFood =
        daysInMonth > 0
            ? foodAllowance /
              daysInMonth
            : 0;


    const foodDue =
        dailyFood *
        payableDays;


    const salaryPaid =
        getMonthlySalaryPaid(
            employee,
            month
        );


    /*
       IMPORTANT:

       Salary paid is not capped at salary due.

       This allows the system to correctly detect
       overpayments.

       Example:

       Salary due  = AED 1,900
       Salary paid = AED 2,000

       Pending     = AED 0
       Overpayment = AED 100
    */

    const pendingSalary =
        Math.max(
            0,
            salaryDue -
            salaryPaid
        );


    const overpayment =
        Math.max(
            0,
            salaryPaid -
            salaryDue
        );


    let status =
        "PENDING";


    if (
        overpayment > 0.009
    ) {

        status =
            "OVERPAID";

    } else if (
        salaryPaid >=
        salaryDue &&
        salaryDue > 0
    ) {

        status =
            "FULLY PAID";

    } else if (
        salaryPaid > 0
    ) {

        status =
            "PARTIALLY PAID";

    }


    if (
        salaryDue <= 0 &&
        leaveDays >=
        salaryPeriodDays &&
        salaryPeriodDays > 0
    ) {

        status =
            "ON LEAVE";

    }


    const advances =
        getMonthlyTransactionTotal(
            employee,
            month,
            "advance"
        );


    const loanRepayments =
        getMonthlyTransactionTotal(
            employee,
            month,
            "loan_repayment"
        );


    const adjustments =
        getMonthlyTransactionTotal(
            employee,
            month,
            "adjustment"
        );


    return {

        salary:
            basicSalary,

        food:
            foodDue,

        salaryDue,

        salaryPaid,

        pending:
            pendingSalary,

        overpayment,

        status,

        advances,

        loanRepayments,

        adjustments,

        leaveDays,

        payableDays,

        salaryStartDate,

        salaryStartDay,

        salaryPeriodDays

    };

}

/* =====================================================
   PREVIOUS MONTH
===================================================== */

function previousMonth(month) {

    const parts =
        String(month || "")
            .split("-")
            .map(Number);

    if (
        parts.length !== 2 ||
        isNaN(parts[0]) ||
        isNaN(parts[1])
    ) {
        return "";
    }


    const date =
        new Date(
            parts[0],
            parts[1] - 2,
            1
        );


    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}`;

}


/* =====================================================
   DAYS IN MONTH
===================================================== */

function daysInMonth(month) {

    const parts =
        String(month || "")
            .split("-")
            .map(Number);

    if (
        parts.length !== 2 ||
        isNaN(parts[0]) ||
        isNaN(parts[1])
    ) {
        return 0;
    }


    return new Date(
        parts[0],
        parts[1],
        0
    ).getDate();

}


/* =====================================================
   PREVIOUS MONTH PENDING
===================================================== */

function getPreviousMonthPending(
    employee,
    month
) {

    const previous =
        previousMonth(month);


    if (!previous)
        return 0;


    const previousPayroll =
        payrollFor(
            employee,
            previous
        );


    return positiveBalance(
        previousPayroll.pending
    );

}


/* =====================================================
   TOTAL PENDING
===================================================== */

function getTotalPending(
    employee
) {

    if (!employee)
        return 0;


    let total = 0;


    let month =
        currentMonth();


    for (
        let i = 0;
        i < 120;
        i++
    ) {

        const payroll =
            payrollFor(
                employee,
                month
            );


        total +=
            positiveBalance(
                payroll.pending
            );


        month =
            previousMonth(
                month
            );


        if (!month)
            break;

    }


    return total;

}


/* =====================================================
   LAST PENDING MONTH
===================================================== */

function getLastPendingMonth(
    employee,
    month
) {

    let checkMonth =
        previousMonth(
            month
        );


    for (
        let i = 0;
        i < 120;
        i++
    ) {

        if (!checkMonth)
            break;


        const payroll =
            payrollFor(
                employee,
                checkMonth
            );


        if (
            positiveBalance(
                payroll.pending
            ) > 0
        ) {

            return checkMonth;

        }


        checkMonth =
            previousMonth(
                checkMonth
            );

    }


    return null;

}


/* =====================================================
   EMPLOYEE PAYROLL SUMMARY
===================================================== */

function getEmployeePayrollSummary(
    employee,
    month
) {

    const payroll =
        payrollFor(
            employee,
            month
        );


    const previousPending =
        getPreviousMonthPending(
            employee,
            month
        );


    return {

        ...payroll,

        previousPending,

        totalPending:
            previousPending +
            positiveBalance(
                payroll.pending
            ),

        totalOverpayment:
            positiveBalance(
                payroll.overpayment
            )

    };

}


/* =====================================================
   TRANSACTION TYPE LABEL
===================================================== */

function transactionTypeLabel(
    type
) {

    const labels = {

        salary:
            "Salary Payment",

        advance:
            "Advance",

        loan:
            "Loan",

        loan_repayment:
            "Loan Repayment",

        adjustment:
            "Adjustment"

    };


    return (
        labels[type] ||
        type ||
        "Transaction"
    );

}


/* =====================================================
   UPDATE TRANSACTION
===================================================== */

function updateTransaction(
    id
) {

    const transaction =
        state.transactions.find(
            item =>
                item.id === id
        );


    if (!transaction)
        return;


    const employeeId =
        $("transactionEmployee")?.value;


    const type =
        $("transactionType")?.value;


    const amount =
        Number(
            $("transactionAmount")?.value || 0
        );


    const date =
        $("transactionDate")?.value;


    const notes =
        $("transactionNotes")?.value || "";


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


    if (!date) {

        alert(
            "Please select a date."
        );

        return;

    }


    transaction.employeeId =
        employeeId;

    transaction.type =
        type;

    transaction.amount =
        amount;

    transaction.date =
        date;

    transaction.notes =
        notes;


    save();

    renderAll();

    closeModal();

}


/* =====================================================
   DELETE TRANSACTION
===================================================== */

function deleteTransaction(
    id
) {

    const transaction =
        state.transactions.find(
            item =>
                item.id === id
        );


    if (!transaction)
        return;


    if (
        !confirm(
            "Delete this transaction?"
        )
    )
        return;


    state.transactions =
        state.transactions.filter(
            item =>
                item.id !== id
        );


    save();

    renderAll();

}

        const payroll =
            payrollFor(
                employee,
                key
            );

        totalPending +=
            Number(
                payroll.pending || 0
            );

        checkDate =
            new Date(
                checkDate.getFullYear(),
                checkDate.getMonth() + 1,
                1
            );
    }

    return positiveBalance(
        totalPending
    );
}


/* =====================================================
   TOTAL PENDING SALARY
===================================================== */

function getTotalPendingSalary(
    employee,
    selectedMonth
) {

    const currentPayroll =
        payrollFor(
            employee,
            selectedMonth
        );

    const previousPending =
        getPreviousPendingSalary(
            employee,
            selectedMonth
        );

    return positiveBalance(
        Number(
            currentPayroll.pending || 0
        ) +
        Number(
            previousPending || 0
        )
    );
}


/* =====================================================
   TOTAL OVERPAYMENT
===================================================== */

function getTotalOverpayment(
    employee,
    selectedMonth
) {

    const payroll =
        payrollFor(
            employee,
            selectedMonth
        );

    return positiveBalance(
        Number(
            payroll.overpayment || 0
        )
    );
}


/* =====================================================
   EMPLOYEE PAYROLL SUMMARY
===================================================== */

function getEmployeePayrollSummary(
    employee,
    selectedMonth
) {

    const payroll =
        payrollFor(
            employee,
            selectedMonth
        );

    const previousPending =
        getPreviousPendingSalary(
            employee,
            selectedMonth
        );

    const totalPending =
        positiveBalance(
            Number(
                payroll.pending || 0
            ) +
            Number(
                previousPending || 0
            )
        );

    const overpayment =
        positiveBalance(
            Number(
                payroll.overpayment || 0
            )
        );

    return {
        employeeId:
            employee.id,

        employeeName:
            employeeName(employee),

        salary:
            Number(
                payroll.salary || 0
            ),

        food:
            Number(
                payroll.food || 0
            ),

        salaryDue:
            Number(
                payroll.salaryDue || 0
            ),

        salaryPaid:
            Number(
                payroll.salaryPaid || 0
            ),

        pending:
            totalPending,

        overpayment:
            overpayment,

        status:
            payroll.status,

        advances:
            Number(
                payroll.advances || 0
            ),

        loanRepayments:
            Number(
                payroll.loanRepayments || 0
            ),

        adjustments:
            Number(
                payroll.adjustments || 0
            ),

        leaveDays:
            Number(
                payroll.leaveDays || 0
            ),

        payableDays:
            Number(
                payroll.payableDays || 0
            ),

        salaryStartDay:
            payroll.salaryStartDay,

        salaryPeriodDays:
            payroll.salaryPeriodDays,

        salaryStartDate:
            payroll.salaryStartDate,

        previousPending:
            Number(
                previousPending || 0
            )
    };
}


/* =====================================================
   TRANSACTION TYPE LABEL
===================================================== */

function transactionTypeLabel(
    type
) {

    switch (type) {

        case "salary":
            return "Salary";

        case "advance":
            return "Advance";

        case "loan":
            return "Loan";

        case "loan_repayment":
            return "Loan Repayment";

        case "adjustment":
            return "Adjustment";

        default:
            return type || "";
    }
}


/* =====================================================
   FORMAT CURRENCY
===================================================== */

function formatAED(
    amount
) {

    const value =
        Number(amount || 0);

    return (
        "AED " +
        value.toFixed(2)
    );
}


/* =====================================================
   TRANSACTION DATE
===================================================== */

function formatDate(
    date
) {

    if (!date) {
        return "";
    }

    const d =
        new Date(date);

    if (
        Number.isNaN(
            d.getTime()
        )
    ) {
        return date;
    }

    return (
        String(
            d.getDate()
        ).padStart(2, "0") +
        "/" +
        String(
            d.getMonth() + 1
        ).padStart(2, "0") +
        "/" +
        d.getFullYear()
    );
}

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


    const onLeave =
        getEmployeesOnLeave(
            month
        );


    const totalEmployees =
        state.employees.length;


    const dashboardTotalSalaries =
        $("dashboardTotalSalaries");

    const dashboardTotalFood =
        $("dashboardTotalFood");

    const dashboardTotalPaid =
        $("dashboardTotalPaid");

    const dashboardTotalPending =
        $("dashboardTotalPending");

    const dashboardTotalOverpayment =
        $("dashboardTotalOverpayment");

    const dashboardTotalLoans =
        $("dashboardTotalLoans");

    const dashboardEmployees =
        $("dashboardEmployees");

    const dashboardOnLeave =
        $("dashboardOnLeave");


    if (
        dashboardTotalSalaries
    ) {
        dashboardTotalSalaries.textContent =
            formatAED(
                totalSalaries
            );
    }


    if (
        dashboardTotalFood
    ) {
        dashboardTotalFood.textContent =
            formatAED(
                totalFood
            );
    }


    if (
        dashboardTotalPaid
    ) {
        dashboardTotalPaid.textContent =
            formatAED(
                totalPaid
            );
    }


    if (
        dashboardTotalPending
    ) {
        dashboardTotalPending.textContent =
            formatAED(
                totalPending
            );
    }


    if (
        dashboardTotalOverpayment
    ) {
        dashboardTotalOverpayment.textContent =
            formatAED(
                totalOverpayment
            );
    }


    if (
        dashboardTotalLoans
    ) {
        dashboardTotalLoans.textContent =
            formatAED(
                totalLoans
            );
    }


    if (
        dashboardEmployees
    ) {
        dashboardEmployees.textContent =
            totalEmployees;
    }


    if (
        dashboardOnLeave
    ) {
        dashboardOnLeave.textContent =
            onLeave;
    }


    const previousPendingElement =
        $("dashboardPreviousPending");

    if (
        previousPendingElement
    ) {
        previousPendingElement.textContent =
            formatAED(
                totalPreviousPending
            );
    }
}


/* =====================================================
   EMPLOYEES
===================================================== */

function renderEmployees() {

    const tbody =
        $("employeesBody");

    if (!tbody)
        return;


    tbody.innerHTML =
        state.employees
            .map(
                employee => {

                    const payroll =
                        payrollFor(
                            employee,
                            currentMonth()
                        );

                    const loan =
                        Math.max(
                            0,
                            outstandingLoan(
                                employee
                            )
                        );

                    return `
                        <tr>

                            <td>
                                ${escapeHTML(
                                    employee.id
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    employee.name
                                )}
                            </td>

                            <td>
                                ${formatAED(
                                    employee.salary
                                )}
                            </td>

                            <td>
                                ${formatAED(
                                    employee.food
                                )}
                            </td>

                            <td>
                                ${formatAED(
                                    loan
                                )}
                            </td>

                            <td>
                                ${statusHTML(
                                    payroll.status
                                )}
                            </td>

                            <td>

                                <button
                                    class="action-btn"
                                    onclick="editEmployee('${escapeHTML(
                                        employee.id
                                    )}')"
                                >
                                    Edit
                                </button>

                                <button
                                    class="action-btn danger-btn"
                                    onclick="deleteEmployee('${escapeHTML(
                                        employee.id
                                    )}')"
                                >
                                    Delete
                                </button>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");
}


/* =====================================================
   TRANSACTIONS
===================================================== */

function renderTransactions() {

    const tbody =
        $("transactionsBody");

    if (!tbody)
        return;


    const employeeFilter =
        $("transactionEmployee")
            ?.value || "";

    const typeFilter =
        $("transactionType")
            ?.value || "";

    const monthFilter =
        $("transactionMonth")
            ?.value || "";


    let transactions =
        [...state.transactions];


    if (
        employeeFilter
    ) {
        transactions =
            transactions.filter(
                transaction =>
                    transaction.employeeId ===
                    employeeFilter
            );
    }


    if (
        typeFilter
    ) {
        transactions =
            transactions.filter(
                transaction =>
                    transaction.type ===
                    typeFilter
            );
    }


    if (
        monthFilter
    ) {
        transactions =
            transactions.filter(
                transaction =>
                    monthKey(
                        transaction.date
                    ) ===
                    monthFilter
            );
    }


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


    tbody.innerHTML =
        transactions
            .map(
                transaction => {

                    const employee =
                        getEmployee(
                            transaction.employeeId
                        );

                    return `
                        <tr>

                            <td>
                                ${formatDate(
                                    transaction.date
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    employee
                                        ? employee.name
                                        : transaction.employeeId
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    transactionTypeLabel(
                                        transaction.type
                                    )
                                )}
                            </td>

                            <td>
                                ${formatAED(
                                    transaction.amount
                                )}
                            </td>

                            <td>
                                ${escapeHTML(
                                    transaction.notes ||
                                    ""
                                )}
                            </td>

                            <td>

                                <button
                                    class="action-btn"
                                    onclick="editTransaction('${escapeHTML(
                                        transaction.id
                                    )}')"
                                >
                                    Edit
                                </button>

                                <button
                                    class="action-btn danger-btn"
                                    onclick="deleteTransaction('${escapeHTML(
                                        transaction.id
                                    )}')"
                                >
                                    Delete
                                </button>

                            </td>

                        </tr>
                    `;
                }
            )
            .join("");


    const emptyRow =
        `
        <tr>
            <td
                colspan="6"
                class="empty-state"
            >
                No transactions found.
            </td>
        </tr>
        `;


    if (
        transactions.length === 0
    ) {
        tbody.innerHTML =
            emptyRow;
    }
}

        <tbody>
            ${
                state.employees.length
                    ?
                state.employees
                    .map(
                        employee => {

                            const payroll =
                                payrollFor(
                                    employee,
                                    month
                                );

                            const loan =
                                Math.max(
                                    0,
                                    outstandingLoan(
                                        employee
                                    )
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
                                                employee.salary || 0
                                            ) +
                                            Number(
                                                employee.food || 0
                                            )
                                        )}
                                    </td>

                                    <td class="num">
                                        ${money(
                                            loan
                                        )}
                                    </td>

                                    <td>

                                        <button
                                            class="small-btn"
                                            onclick="editEmployee('${escapeHTML(
                                                employee.id
                                            )}')"
                                        >
                                            Edit
                                        </button>

                                        <button
                                            class="small-btn danger"
                                            onclick="deleteEmployee('${escapeHTML(
                                                employee.id
                                            )}')"
                                        >
                                            Delete
                                        </button>

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
   LEAVE TABLE
===================================================== */

function renderLeave() {

    const table =
        $("leaveTable");

    if (!table)
        return;


    const monthInput =
        $("leaveMonth");

    const month =
        monthInput?.value ||
        currentMonth();


    if (monthInput) {
        monthInput.value =
            month;
    }


    const rows =
        state.employees
            .map(
                employee => {

                    const payroll =
                        payrollFor(
                            employee,
                            month
                        );

                    return {
                        employee,
                        payroll
                    };
                }
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

                <th>
                    Leave Days
                </th>

                <th>
                    Salary Start
                </th>

                <th>
                    Payable Days
                </th>

                <th>
                    Status
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

                                <td>
                                    ${
                                        row.payroll.leaveDays
                                            ?
                                        row.payroll.leaveDays
                                            + " day(s)"
                                            :
                                        "-"
                                    }
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.payroll.salaryStartDate ||
                                        "-"
                                    )}
                                </td>

                                <td>
                                    ${Number(
                                        row.payroll.payableDays ||
                                        0
                                    )}
                                </td>

                                <td>
                                    ${statusHTML(
                                        row.payroll.status
                                    )}
                                </td>

                                <td>

                                    <button
                                        class="small-btn"
                                        onclick="editLeave('${escapeHTML(
                                            row.employee.id
                                        )}')"
                                    >
                                        Edit
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
   REPORT
===================================================== */

function renderReport() {

    const table =
        $("reportTable");

    if (!table)
        return;


    const monthInput =
        $("reportMonth");

    const month =
        monthInput?.value ||
        currentMonth();


    if (monthInput) {
        monthInput.value =
            month;
    }


    const rows =
        state.employees.map(
            employee =>
                getEmployeePayrollSummary(
                    employee,
                    month
                )
        );


    const totalSalary =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                Number(
                    row.salaryDue || 0
                ),
            0
        );


    const totalFood =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                Number(
                    row.food || 0
                ),
            0
        );


    const totalPaid =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                Number(
                    row.salaryPaid || 0
                ),
            0
        );


    const totalPending =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                positiveBalance(
                    row.pending
                ),
            0
        );


    const totalOverpayment =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                positiveBalance(
                    row.overpayment
                ),
            0
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
                    Salary Due
                </th>

                <th class="num">
                    Food
                </th>

                <th class="num">
                    Salary Paid
                </th>

                <th class="num">
                    Pending
                </th>

                <th class="num">
                    Overpayment
                </th>

                <th>
                    Status
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
                                    ${escapeHTML(
                                        row.employeeId
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.employeeName
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.salaryDue
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.food
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.salaryPaid
                                    )}
                                </td>

                                <td class="num">
                                    ${pendingMoney(
                                        row.pending
                                    )}
                                </td>

                                <td class="num">

                                    ${
                                        positiveBalance(
                                            row.overpayment
                                        ) > 0
                                            ?
                                        money(
                                            positiveBalance(
                                                row.overpayment
                                            )
                                        )
                                            :
                                        "-"
                                    }

                                </td>

                                <td>
                                    ${statusHTML(
                                        row.status
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
                            colspan="8"
                            class="empty"
                        >
                            No employees found.
                        </td>

                    </tr>
                `
            }

        </tbody>

        <tfoot>

            <tr>

                <th colspan="2">
                    Total
                </th>

                <th class="num">
                    ${money(
                        totalSalary
                    )}
                </th>

                <th class="num">
                    ${money(
                        totalFood
                    )}
                </th>

                <th class="num">
                    ${money(
                        totalPaid
                    )}
                </th>

                <th class="num">
                    ${money(
                        totalPending
                    )}
                </th>

                <th class="num">
                    ${money(
                        totalOverpayment
                    )}
                </th>

                <th></th>

            </tr>

        </tfoot>

    `;
}

                        </td>

                    </tr>

                `
            }
        </tbody>

    `;

}


/* =====================================================
   REPORT TABLE
===================================================== */

function renderReport() {

    if (!$("reportTable"))
        return;


    const month =
        $("reportMonth")
            ? $("reportMonth").value
            : currentMonth();


    const rows =
        state.employees
            .map(
                employee =>
                    getEmployeePayrollSummary(
                        employee,
                        month
                    )
            );


    $("reportTable").innerHTML = `

        <thead>

            <tr>

                <th>Employee ID</th>

                <th>Employee</th>

                <th class="num">
                    Basic Salary
                </th>

                <th class="num">
                    Food
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
                    Overpayment
                </th>

                <th>
                    Status
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
                                        row.salaryDue
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.salaryPaid
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.pendingSalary
                                    )}
                                </td>

                                <td class="num">
                                    ${positiveBalance(
                                        row.overpayment
                                    )}
                                </td>

                                <td>
                                    ${statusHTML(
                                        row.status
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
                            colspan="9"
                            class="empty"
                        >
                            No report data found.
                        </td>

                    </tr>
                `
            }

        </tbody>

    `;

}


/* =====================================================
   EMPLOYEE FORM
===================================================== */

function employeeFormHTML(
    employee = null
) {

    const isEdit =
        !!employee;


    return `

        <div class="form-grid">

            <div class="form-group">

                <label>
                    Employee Name
                </label>

                <input
                    id="employeeName"
                    type="text"
                    value="${
                        employee
                            ? escapeHTML(employee.name)
                            : ""
                    }"
                    placeholder="Employee name"
                >

            </div>


            <div class="form-group">

                <label>
                    Basic Salary
                </label>

                <input
                    id="employeeSalary"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${
                        employee
                            ? employee.salary
                            : ""
                    }"
                    placeholder="0.00"
                >

            </div>


            <div class="form-group">

                <label>
                    Food Allowance
                </label>

                <input
                    id="employeeFood"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${
                        employee
                            ? employee.food
                            : ""
                    }"
                    placeholder="0.00"
                >

            </div>


            <div class="form-group">

                <label>
                    Joining Date
                </label>

                <input
                    id="employeeJoiningDate"
                    type="date"
                    value="${
                        employee
                            ? (
                                employee.joiningDate ||
                                employee.salaryStartDate ||
                                ""
                            )
                            : ""
                    }"
                >

            </div>

        </div>


        ${
            isEdit
                ?
            `
                <div class="form-note">
                    Employee ID:
                    <b>
                        ${escapeHTML(employee.id)}
                    </b>
                </div>
            `
                :
            ""
        }

    `;

}


/* =====================================================
   ADD EMPLOYEE
===================================================== */

function addEmployee() {

    const name =
        $("employeeName")
            ? $("employeeName").value.trim()
            : "";

    const salary =
        Number(
            $("employeeSalary")
                ? $("employeeSalary").value
                : 0
        );

    const food =
        Number(
            $("employeeFood")
                ? $("employeeFood").value
                : 0
        );

    const joiningDate =
        $("employeeJoiningDate")
            ? $("employeeJoiningDate").value
            : "";


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

        joiningDate:
            joiningDate,

        salaryStartDate:
            joiningDate,

        active:
            true,

        createdAt:
            new Date().toISOString()

    };


    state.employees.push(
        employee
    );


    saveState();


    closeModal();


    renderAll();


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
        getEmployee(employeeId);


    if (!employee)
        return;


    openModal(
        "Edit Employee",
        employeeFormHTML(employee),
        `
            <button
                class="btn secondary"
                onclick="closeModal()"
            >
                Cancel
            </button>

            <button
                class="btn primary"
                onclick="saveEmployeeEdit('${employee.id}')"
            >
                Save Changes
            </button>
        `
    );

}


/* =====================================================
   SAVE EMPLOYEE EDIT
===================================================== */

function saveEmployeeEdit(
    employeeId
) {

    const employee =
        getEmployee(employeeId);


    if (!employee)
        return;


    const name =
        $("employeeName")
            ? $("employeeName").value.trim()
            : "";

    const salary =
        Number(
            $("employeeSalary")
                ? $("employeeSalary").value
                : 0
        );

    const food =
        Number(
            $("employeeFood")
                ? $("employeeFood").value
                : 0
        );

    const joiningDate =
        $("employeeJoiningDate")
            ? $("employeeJoiningDate").value
            : "";


    if (!name) {

        alert(
            "Please enter employee name."
        );

        return;

    }


    employee.name =
        name;

    employee.salary =
        salary;

    employee.food =
        food;

    employee.joiningDate =
        joiningDate;

    employee.salaryStartDate =
        joiningDate;


    saveState();


    closeModal();


    renderAll();

}


/* =====================================================
   DELETE EMPLOYEE
===================================================== */

function deleteEmployee(
    employeeId
) {

    const employee =
        getEmployee(employeeId);


    if (!employee)
        return;


    if (
        !confirm(
            `Delete employee "${employee.name}"?`
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


    saveState();


    renderAll();

}


/* =====================================================
   TRANSACTION FORM
===================================================== */

function transactionFormHTML(
    transaction = null
) {

    const isEdit =
        !!transaction;


    const employeeId =
        transaction
            ? transaction.employeeId
            : "";


    return `

        <div class="form-grid">

            <div class="form-group">

                <label>
                    Employee
                </label>

                <select
                    id="transactionEmployeeInput"
                >

                    <option value="">
                        Select Employee
                    </option>

                    ${
                        state.employees
                            .map(
                                employee => `
                                    <option
                                        value="${escapeHTML(employee.id)}"
                                        ${
                                            employee.id === employeeId
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        ${escapeHTML(employee.id)}
                                        -
                                        ${escapeHTML(employee.name)}
                                    </option>
                                `
                            )
                            .join("")
                    }

                </select>

            </div>


            <div class="form-group">

                <label>
                    Transaction Type
                </label>

                <select
                    id="transactionTypeInput"
                >

                    <option
                        value="salary"
                        ${
                            !transaction ||
                            transaction.type === "salary"
                                ? "selected"
                                : ""
                        }
                    >
                        Salary Payment
                    </option>

                    <option
                        value="advance"
                        ${
                            transaction &&
                            transaction.type === "advance"
                                ? "selected"
                                : ""
                        }
                    >
                        Advance
                    </option>

                    <option
                        value="loan"
                        ${
                            transaction &&
                            transaction.type === "loan"
                                ? "selected"
                                : ""
                        }
                    >
                        Loan Given
                    </option>

                    <option
                        value="loan_repayment"
                        ${
                            transaction &&
                            transaction.type === "loan_repayment"
                                ? "selected"
                                : ""
                        }
                    >
                        Loan Repayment
                    </option>

                    <option
                        value="adjustment"
                        ${
                            transaction &&
                            transaction.type === "adjustment"
                                ? "selected"
                                : ""
                        }
                    >
                        Other Adjustment
                    </option>

                </select>

            </div>


            <div class="form-group">

                <label>
                    Amount
                </label>

                <input
                    id="transactionAmountInput"
                    type="number"
                    min="0"
                    step="0.01"
                    value="${
                        transaction
                            ? transaction.amount
                            : ""
                    }"
                    placeholder="0.00"
                >

            </div>


            <div class="form-group">

                <label>
                    Date
                </label>

                <input
                    id="transactionDateInput"
                    type="date"
                    value="${
                        transaction
                            ? transaction.date
                            : today()
                    }"
                >

            </div>


            <div class="form-group">

                <label>
                    Salary From
                </label>

                <input
                    id="transactionSalaryStartDateInput"
                    type="date"
                    value="${
                        transaction &&
                        transaction.salaryStartDate
                            ?
                        transaction.salaryStartDate
                            :
                        ""
                    }"
                >

            </div>


            <div class="form-group">

                <label>
                    Note
                </label>

                <input
                    id="transactionNoteInput"
                    type="text"
                    value="${
                        transaction
                            ? escapeHTML(
                                transaction.note || ""
                            )
                            : ""
                    }"
                    placeholder="Note"
                >

            </div>

        </div>

    `;

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
                positiveBalance(
                    row.payroll.pending
                ),

            0
        );


    const totalOverpayment =
        rows.reduce(
            (
                total,
                row
            ) =>
                total +
                positiveBalance(
                    row.payroll.overpayment
                ),

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
                "PENDING" &&
                positiveBalance(
                    row.payroll.pending
                ) > 0
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
                    positiveBalance(
                        row.pending
                    ) > 0
            );


    const totalPreviousPending =
        previousPendingRows.reduce(
            (
                total,
                row
            ) =>
                total +
                positiveBalance(
                    row.pending
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
                <span>Overpayment</span>
                <strong>
                    ${money(totalOverpayment)}
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

            <div class="summary-box">
                <span>Previous Salary Pending</span>
                <strong>
                    ${money(totalPreviousPending)}
                </strong>
            </div>

        `;

    }


    const previousPendingHTML = `

        <div
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
                    <div
                        style="
                            overflow-x:auto;
                        "
                    >

                        <table
                            class="report-table"
                            style="width:100%;"
                        >

                            <thead>

                                <tr>

                                    <th>
                                        Employee
                                    </th>

                                    <th class="num">
                                        Previous Salary Pending
                                    </th>

                                </tr>

                            </thead>

                            <tbody>

                                ${
                                    previousPendingRows
                                        .map(
                                            row => `

                                                <tr>

                                                    <td>

                                                        <b>
                                                            ${escapeHTML(
                                                                row.employee.id
                                                            )}
                                                        </b>
                                                        -
                                                        ${escapeHTML(
                                                            row.employee.name
                                                        )}

                                                    </td>

                                                    <td class="num">

                                                        <b>
                                                            ${money(
                                                                positiveBalance(
                                                                    row.pending
                                                                )
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


    const existingPreviousPending =
        document.getElementById(
            "previousPendingReport"
        );


    if (
        existingPreviousPending
    ) {

        existingPreviousPending.innerHTML =
            previousPendingHTML;

    } else if ($("reportTable")) {

        $("reportTable").insertAdjacentHTML(
            "beforebegin",
            `
                <div id="previousPendingReport">
                    ${previousPendingHTML}
                </div>
            `
        );

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

                <th class="num">
                    Overpayment
                </th>

                <th>Status</th>

                <th class="num">
                    Advances
                </th>

                <th class="num">
                    Loan Repayment
                </th>

                <th>Salary From</th>

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
                                


}

                                    ${escapeHTML(
                                        row.employee.id
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        row.employee.name
                                    )}
                                </td>

                                <td class="num">
                                    ${money(
                                        row.payroll.salaryDue
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
                                        ${pendingMoney(
                                            row.payroll.pending
                                        )}
                                    </b>
                                </td>

                                <td class="num">
                                    <b>
                                        ${
                                            positiveBalance(
                                                row.payroll.overpayment
                                            ) > 0
                                                ?
                                            money(
                                                positiveBalance(
                                                    row.payroll.overpayment
                                                )
                                            )
                                                :
                                            "-"
                                        }
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
                                        row.payroll.salaryStartDate
                                            ?
                                        escapeHTML(
                                            row.payroll.salaryStartDate
                                        )
                                            :
                                        "-"
                                    }
                                </td>

                                <td>
                                    ${
                                        row.payroll.status ===
                                        "ON LEAVE"
                                            ?
                                        "ON LEAVE"
                                            :
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
                            colspan="12"
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


    /*
       Salary Calculation From.

       For a new salary transaction, default to
       the transaction date.

       For an existing salary transaction, use
       its saved salaryStartDate.
    */

    const salaryStartDate =
        transaction &&
        transaction.salaryStartDate
            ?
        transaction.salaryStartDate
            :
        (
            type === "salary"
                ? date
                : ""
        );


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
                    Transaction Date
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
                    id="transactionFormType"
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


            <div
                class="form-field full"
                id="salaryStartDateField"
                style="${
                    type === "salary"
                        ? ""
                        : "display:none;"
                }"
            >

                <label>
                    Salary Calculation From
                </label>

                <input
                    name="salaryStartDate"
                    id="salaryStartDateInput"
                    type="date"
                    value="${escapeHTML(
                        salaryStartDate
                    )}"
                >

                <small
                    style="
                        opacity:.7;
                        display:block;
                        margin-top:5px;
                    "
                >
                    Enter the date from which this
                    employee's salary should be calculated
                    for the selected month. For example,
                    if the employee returns from vacation
                    on 20 August, select 20 August.
                </small>

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
   VALIDATE SALARY START DATE
===================================================== */

function validateSalaryStartDate(
    type,
    date,
    salaryStartDate
) {

    if (
        type !== "salary"
    ) {

        return true;

    }


    if (!salaryStartDate) {

        return true;

    }


    if (
        monthKey(
            salaryStartDate
        ) !==
        monthKey(date)
    ) {

        alert(
            "Salary Calculation From date must be in the same month as the transaction date."
        );

        return false;

    }


    return true;

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


            const salaryStartDate =
                formData.get(
                    "salaryStartDate"
                );


            if (
                amount <= 0
            ) {

                alert(
                    "Please enter an amount greater than zero."
                );

                return;

            }


            if (
                !validateSalaryStartDate(
                    type,
                    date,
                    salaryStartDate
                )
            ) {

                return;

            }


            state.transactions.push({
                            id:
                    generateID("TX"),

                employeeId,

                date,

                type,

                amount,

                salaryStartDate:
                    type === "salary"
                        ?
                    (
                        salaryStartDate ||
                        date
                    )
                        :
                    "",

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


    setupSalaryStartDateBehaviour();

}


/* =====================================================
   SALARY START DATE UI BEHAVIOUR
===================================================== */

function setupSalaryStartDateBehaviour() {

    const typeSelect =
        $("transactionFormType");


    const startDateField =
        $("salaryStartDateField");


    const startDateInput =
        $("salaryStartDateInput");


    if (
        !typeSelect ||
        !startDateField ||
        !startDateInput
    ) {

        return;

    }


    const update =
        () => {

            const isSalary =
                typeSelect.value ===
                "salary";


            startDateField.style.display =
                isSalary
                    ? ""
                    : "none";


            if (!isSalary) {

                startDateInput.value =
                    "";

            }

        };


    typeSelect.addEventListener(
        "change",
        update
    );


    update();

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


            const salaryStartDate =
                formData.get(
                    "salaryStartDate"
                );


            if (
                amount <= 0
            ) {

                alert(
                    "Please enter an amount greater than zero."
                );

                return;

            }


            if (
                !validateSalaryStartDate(
                    type,
                    date,
                    salaryStartDate
                )
            ) {

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


            transaction.salaryStartDate =
                type === "salary"
                    ?
                (
                    salaryStartDate ||
                    date
                )
                    :
                "";


            transaction.note =
                formData
                    .get("note")
                    .trim();


            save();

            closeModal();

            renderAll();

        }

    );


    setupSalaryStartDateBehaviour();

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


/* =====================================================
   PRINT REPORT
   SHOW SELECTED REPORT MONTH

   IMPORTANT:

   This does NOT change payroll calculations.

   It temporarily adds a print-only heading
   immediately before the report table.

   The heading is removed after printing.

   The selected report month is used, NOT the
   computer's current date.
===================================================== */

function printPayrollReport() {

    const reportMonth =
        $("reportMonth")
            ? $("reportMonth").value
            : currentMonth();


    const formattedMonth =
        new Date(
            reportMonth + "-01T00:00:00"
        ).toLocaleDateString(
            "en-US",
            {
                month: "long",
                year: "numeric"
            }
        );


    if (!$("reportTable")) {

        window.print();

        return;

    }


    /*
       Prevent duplicate temporary headers.
    */

    const existingHeader =
        document.getElementById(
            "temporaryPayrollPrintHeader"
        );


    if (existingHeader) {

        existingHeader.remove();

    }


    /*
       Create temporary print heading.
       The selected report month appears
       NEXT TO "MONTHLY PAYROLL REPORT".
    */

    const printHeader =
        document.createElement("div");


    printHeader.id =
        "temporaryPayrollPrintHeader";


    printHeader.innerHTML = `

        <div
            style="
                text-align:center;
                font-family:Arial,sans-serif;
                margin:0 0 20px 0;
                padding:0;
            "
        >

            <div
                style="
                    font-size:24px;
                    font-weight:bold;
                    margin-bottom:6px;
                "
            >
                AL JEFOON TENTS
            </div>


            <div
                style="
                    font-size:20px;
                    font-weight:bold;
                    margin-bottom:4px;
                "
            >
                MONTHLY PAYROLL REPORT -
                ${escapeHTML(formattedMonth)}
            </div>

        </div>

    `;


    /*
       Put heading directly before report table.
    */

    $("reportTable").parentNode.insertBefore(
        printHeader,
        $("reportTable")
    );


    /*
       Remove any previous temporary print date.
    */

    const oldPrintDate =
        document.getElementById(
            "temporaryPayrollPrintDate"
        );


    if (oldPrintDate) {

        oldPrintDate.remove();

    }


    /*
       Print.
    */

    window.print();


    /*
       Remove temporary heading after printing.
    */

    setTimeout(
        () => {

            const header =
                document.getElementById(
                    "temporaryPayrollPrintHeader"
                );


            if (header) {

                header.remove();

            }

        },
        1000
    );

}


if ($("printReportBtn"))
    $("printReportBtn").onclick =
        printPayrollReport;


/* =====================================================
   INITIAL MONTHS
===================================================== */

if ($("dashboardMonth"))
    $("dashboardMonth").value =
        currentMonth();


if ($("transactionMonth"))
    $("transactionMonth").value =
        currentMonth();

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
