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
   VERSION 2.7

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

    if (!date) return "";

    const d = new Date(
        String(date).length === 10
            ? `${date}T00:00:00`
            : date
    );

    if (isNaN(d.getTime())) return "";

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
   MONTHLY ADVANCE TOTAL
===================================================== */

function getMonthlyAdvanceTotal(
    employee,
    month
) {

    return getMonthlyTransactionTotal(
        employee,
        month,
        "advance"
    );

}


/* =====================================================
   MONTHLY LOAN TOTAL
===================================================== */

function getMonthlyLoanTotal(
    employee,
    month
) {

    return getMonthlyTransactionTotal(
        employee,
        month,
        "loan"
    );

}
