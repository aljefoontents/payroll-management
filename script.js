/* =====================================================
   AL JEFOON TENTS
   PAYROLL SYSTEM
   SCRIPT.JS
   VERSION 2.6

   FEATURES:
   - Employee IDs start at EMP003
   - Basic salary only used for salary calculations
   - Food allowance displayed separately
   - Salary / Advance / Loan editing
   - Leave editing
   - Leave dates optional
   - Leave days optional
   - Unpaid leave deducted from salary
   - Salary calculation can start from a selected date
   - Employees returning from vacation can be paid
     from their return/salary-start date
   - Previous salary pending calculated correctly
   - Zero previous pending balances are hidden
   - Previous pending is separate from current pending
   - Dark mode
   - Original print behaviour retained
===================================================== */


/* =====================================================
   STORAGE
===================================================== */

const STORAGE_KEY =
    "alJefoonPayrollV1";

const DARK_MODE_KEY =
    "alJefoonPayrollDarkMode";


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

    const amount =
        Number(value || 0);

    return `AED ${amount.toLocaleString(
        "en-AE",
        {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }
    )}`;

}


function monthKey(date) {

    if (!date)
        return "";

    const d =
        new Date(date);

    if (isNaN(d.getTime()))
        return "";

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, "0")}`;

}


function currentMonth() {

    const d =
        new Date();

    return `${d.getFullYear()}-${String(
        d.getMonth() + 1
    ).padStart(2, "0")}`;

}


function escapeHTML(value) {

    return String(value ?? "")
        .replace(
            /[&<>"']/g,
            character => {

                const entities = {

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"

                };

                return entities[
                    character
                ];

            }
        );

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

    state.employees.forEach(
        employee => {

            const match =
                String(
                    employee.id || ""
                ).match(
                    /^EMP(\d+)$/i
                );

            if (match) {

                const number =
                    parseInt(
                        match[1],
                        10
                    );

                if (
                    number >
                    highestNumber
                ) {

                    highestNumber =
                        number;

                }

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
   DATE HELPERS
===================================================== */

function makeLocalDate(
    year,
    monthNumber,
    day
) {

    return new Date(
        year,
        monthNumber - 1,
        day
    );

}


function parseDateOnly(
    value
) {

    if (!value)
        return null;

    const parts =
        String(value)
            .split("-")
            .map(Number);

    if (
        parts.length !== 3 ||
        parts.some(
            number =>
                !Number.isFinite(number)
        )
    ) {

        return null;

    }

    const date =
        new Date(
            parts[0],
            parts[1] - 1,
            parts[2]
        );

    if (
        isNaN(
            date.getTime()
        )
    ) {

        return null;

    }

    return date;

}


function formatDateInput(
    date
) {

    if (!date)
        return "";

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;

}


/* =====================================================
   FIND SALARY START DATE
===================================================== */

/*
   The Salary Calculation From date is stored
   on salary transactions.

   For a selected month, we use the earliest valid
   salary-start date entered for that employee
   during that month.

   If there is no salary-start date, salary starts
   from the first day of the month.
*/

function getSalaryStartDay(
    employee,
    month,
    daysInMonth
) {

    let startDay = 1;

    const salaryTransactions =
        state.transactions.filter(
            transaction => {

                if (
                    transaction.employeeId !==
                    employee.id
                ) {

                    return false;

                }

                if (
                    transaction.type !==
                    "salary"
                ) {

                    return false;

                }

                if (
                    monthKey(
                        transaction.date
                    ) !== month
                ) {

                    return false;

                }

                return true;

            }
        );


    const startDays =
        salaryTransactions
            .map(
                transaction => {

                    if (
                        !transaction.salaryStartDate
                    ) {

                        return null;

                    }

                    const date =
                        parseDateOnly(
                            transaction.salaryStartDate
                        );

                    if (!date)
                        return null;

                    if (
                        monthKey(
                            transaction.salaryStartDate
                        ) !== month
                    ) {

                        return null;

                    }

                    return date.getDate();

                }
            )
            .filter(
                day =>
                    Number.isFinite(day) &&
                    day >= 1 &&
                    day <= daysInMonth
            );


    if (
        startDays.length
    ) {

        /*
           IMPORTANT:

           Use the earliest salary start date
           recorded for the month.

           This prevents a later salary payment
           from incorrectly reducing the salary
           period again.
        */

        startDay =
            Math.min(
                ...startDays
            );

    }


    return Math.min(
        Math.max(
            startDay,
            1
        ),
        daysInMonth
    );

}


/* =====================================================
   EMPLOYEE LEAVE CHECK
===================================================== */

function isEmployeeOnLeave(
    employee,
    month
) {

    const [year, monthNumber] =
        month.split("-").map(Number);

    const daysInMonth =
        new Date(
            year,
            monthNumber,
            0
        ).getDate();

    const monthStart =
        makeLocalDate(
            year,
            monthNumber,
            1
        );

    const monthEnd =
        makeLocalDate(
            year,
            monthNumber,
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
               No dates but days entered.

               This is treated as leave for the
               selected month.
            */

            if (
                !leave.startDate &&
                !leave.endDate
            ) {

                return Number(
                    leave.days || 0
                ) >= daysInMonth;

            }


            /*
               Start date but no end date.

               Leave continues through the end
               of the selected month.
            */

            if (
                leave.startDate &&
                !leave.endDate
            ) {

                const start =
                    parseDateOnly(
                        leave.startDate
                    );

                if (!start)
                    return false;

                return (
                    start <= monthEnd
                );

            }


            /*
               End date but no start date.

               Treat the leave as beginning
               before / at the selected month.
            */

            if (
                !leave.startDate &&
                leave.endDate
            ) {

                const end =
                    parseDateOnly(
                        leave.endDate
                    );

                if (!end)
                    return false;

                return (
                    end >= monthStart
                );

            }


            /*
               Both dates exist.
            */

            const start =
                parseDateOnly(
                    leave.startDate
                );

            const end =
                parseDateOnly(
                    leave.endDate
                );

            if (
                !start ||
                !end
            ) {

                return false;

            }

            return (
                start <= monthEnd &&
                end >= monthStart
            );

        }
    );

}


/* =====================================================
   LEAVE DAYS FOR MONTH
===================================================== */

function getLeaveDaysForMonth(
    employee,
    month,
    daysInMonth,
    salaryStartDay
) {

    const [year, monthNumber] =
        month.split("-").map(Number);


    const monthStart =
        makeLocalDate(
            year,
            monthNumber,
            1
        );


    const monthEnd =
        makeLocalDate(
            year,
            monthNumber,
            daysInMonth
        );


    /*
       Salary period starts from salaryStartDay.
    */

    const salaryStart =
        makeLocalDate(
            year,
            monthNumber,
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

                   Use manually entered number of days
                   if supplied.
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
                        parseDateOnly(
                            leave.startDate
                        );

                    if (!leaveStart)
                        return;


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


                    /*
                       If days were manually entered,
                       use those days.

                       Otherwise calculate through the
                       end of the selected month.
                    */

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
                            monthEnd.getTime() -
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
                        parseDateOnly(
                            leave.endDate
                        );

                    if (!leaveEnd)
                        return;


                    const actualEnd =
                        leaveEnd <
                        monthEnd
                            ? leaveEnd
                            : monthEnd;


                    if (
                        actualEnd <
                        salaryStart
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

                    }

                    return;

                }


                /*
                   Both start and end dates exist.
                */

                const leaveStart =
                    parseDateOnly(
                        leave.startDate
                    );

                const leaveEnd =
                    parseDateOnly(
                        leave.endDate
                    );


                if (
                    !leaveStart ||
                    !leaveEnd
                ) {

                    return;

                }


                /*
                   Find overlap between:

                   - salary calculation period
                   - selected month
                   - unpaid leave
                */

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
   MONTHLY SALARY PAID
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

       Example:

       August 20 =
       salary starts on August 20.

       Payable calendar days =
       August 20 through August 31.
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
       Salary is calculated from the selected
       salary-start date.

       We DO NOT automatically mark the employee
       as ON LEAVE merely because a leave record
       exists before the salary-start date.

       This is important for employees returning
       from vacation.
    */


    const leaveDays =
        getLeaveDaysForMonth(
            employee,
            month,
            daysInMonth,
            salaryStartDay
        );


    const payableDays =
        Math.max(
            0,
            salaryPeriodDays -
            leaveDays
        );


    /*
       Daily salary is based on the actual number
       of calendar days in the selected month.
    */

    const dailySalary =
        daysInMonth > 0
            ? basicSalary / daysInMonth
            : 0;


    const salaryDue =
        Math.max(
            0,
            dailySalary *
            payableDays
        );


    /*
       Salary actually paid during this month.
    */

    const salaryPaidRaw =
        getMonthlySalaryPaid(
            employee,
            month
        );


    /*
       IMPORTANT:

       Do not let an overpayment make the calculation
       appear partially paid.

       If amount paid >= salary due,
       status must be FULLY PAID.
    */

    const salaryPaid =
        Math.min(
            Math.max(
                0,
                salaryPaidRaw
            ),
            salaryDue
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

        salaryDue,

        salaryPaid,

        pending:
            pendingSalary,

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
   PREVIOUS MONTH PENDING SALARY
   CORRECTED VERSION
===================================================== */

/*
   This function calculates only REAL unpaid salary
   from months BEFORE the currently selected month.

   It deliberately does NOT return rows containing
   AED 0.00.

   It also looks at:

   - salary transactions
   - salary calculation start dates
   - leave records

   and then calculates each historical month.
*/

function getPreviousPendingSalary(
    employee,
    selectedMonth
) {

    const selectedParts =
        selectedMonth
            .split("-")
            .map(Number);


    if (
        selectedParts.length !== 2 ||
        !Number.isFinite(selectedParts[0]) ||
        !Number.isFinite(selectedParts[1])
    ) {

        return 0;

    }


    const selectedDate =
        new Date(
            selectedParts[0],
            selectedParts[1] - 1,
            1
        );


    const months =
        new Set();


    /*
       Salary transactions.

       These identify months in which the employee
       had salary activity.
    */

    state.transactions.forEach(
        transaction => {

            if (
                transaction.employeeId !==
                employee.id
            ) {

                return;

            }


            if (
                transaction.type !==
                "salary"
            ) {

                return;

            }


            const transactionMonth =
                monthKey(
                    transaction.date
                );


            if (!transactionMonth)
                return;


            const parts =
                transactionMonth
                    .split("-")
                    .map(Number);


            const transactionDate =
                new Date(
                    parts[0],
                    parts[1] - 1,
                    1
                );


            if (
                transactionDate <
                selectedDate
            ) {

                months.add(
                    transactionMonth
                );

            }


            /*
               Also use salaryStartDate.

               This is important for employees whose
               salary calculation began on a particular
               date.
            */

            if (
                transaction.salaryStartDate
            ) {

                const startMonth =
                    monthKey(
                        transaction.salaryStartDate
                    );


                if (startMonth) {

                    const startParts =
                        startMonth
                            .split("-")
                            .map(Number);


                    const startDate =
                        new Date(
                            startParts[0],
                            startParts[1] - 1,
                            1
                        );


                    if (
                        startDate <
                        selectedDate
                    ) {

                        months.add(
                            startMonth
                        );

                    }

                }

            }

        }
    );


    /*
       Leave records.

       Include every historical month touched
       by a leave record.
    */

    state.leaves.forEach(
        leave => {

            if (
                leave.employeeId !==
                employee.id
            ) {

                return;

            }


            if (
                leave.startDate
            ) {

                const startMonth =
                    monthKey(
                        leave.startDate
                    );


                if (startMonth) {

                    const parts =
                        startMonth
                            .split("-")
                            .map(Number);


                    const date =
                        new Date(
                            parts[0],
                            parts[1] - 1,
                            1
                        );


                    if (
                        date <
                        selectedDate
                    ) {

                        months.add(
                            startMonth
                        );

                    }

                }

            }


            if (
                leave.endDate
            ) {

                const endMonth =
                    monthKey(
                        leave.endDate
                    );


                if (endMonth) {

                    const parts =
                        endMonth
                            .split("-")
                            .map(Number);


                    const date =
                        new Date(
                            parts[0],
                            parts[1] - 1,
                            1
                        );


                    if (
                        date <
                        selectedDate
                    ) {

                        months.add(
                            endMonth
                        );

                    }

                }

            }

        }
    );


    /*
       If there is no historical salary/leave data,
       there is no previous pending salary.
    */

    if (
        months.size === 0
    ) {

        return 0;

    }


    /*
       Find earliest historical month.
    */

    let earliestDate =
        null;


    months.forEach(
        key => {

            const parts =
                key.split("-")
                    .map(Number);


            const date =
                new Date(
                    parts[0],
                    parts[1] - 1,
                    1
                );


            if (
                date >=
                selectedDate
            ) {

                return;

            }


            if (
                !earliestDate ||
                date <
                earliestDate
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
           Only add REAL outstanding salary.

           Never add zero.

           Do not count ON LEAVE as pending.
        */

        if (
            payroll.status !==
            "ON LEAVE"
        ) {

            const pending =
                Number(
                    payroll.pending || 0
                );


            if (
                pending > 0
            ) {

                totalPending +=
                    pending;

            }

        }


        checkDate =
            new Date(
                checkDate.getFullYear(),
                checkDate.getMonth() + 1,
                1
            );

    }


    /*
       Final protection against -0 / NaN /
       floating-point noise.
    */

    if (
        !Number.isFinite(
            totalPending
        ) ||
        totalPending <= 0.005
    ) {

        return 0;

    }


    return Math.max(
        0,
        totalPending
    );

}


/* =====================================================
   EMPLOYEES CURRENTLY ON LEAVE
===================================================== */

function getEmployeesOnLeave(
    month
) {

    const employeeIDs =
        new Set();


    state.leaves.forEach(
        leave => {

            if (
                !leave.employeeId
            )
                return;


            const employee =
                getEmployee(
                    leave.employeeId
                );


            if (!employee)
                return;


            if (
                !isEmployeeOnLeave(
                    employee,
                    month
                )
            ) {

                return;

            }


            employeeIDs.add(
                leave.employeeId
            );

        }
    );


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


    /*
       Only employees with REAL previous pending
       balances are included.
    */

    const previousPendingRows =
        state.employees
            .map(
                employee => {

                    const pending =
                        getPreviousPendingSalary(
                            employee,
                            month
                        );

                    return {
                        employee,
                        pending
                    };

                }
            )
            .filter(
                row =>
                    row.pending > 0.005
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


    if ($("statPreviousPending"))
        $("statPreviousPending").textContent =
            money(totalPreviousPending);


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


    const dashboardPreviousPendingHTML = `

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

                            <tfoot>

                                <tr>

                                    <th>
                                        Total Previous Pending
                                    </th>

                                    <th class="num">
                                        ${money(
                                            totalPreviousPending
                                        )}
                                    </th>

                                </tr>

                            </tfoot>

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


    const existingDashboardPreviousPending =
        document.getElementById(
            "dashboardPreviousPending"
        );


    if (
        existingDashboardPreviousPending
    ) {

        existingDashboardPreviousPending.outerHTML =
            dashboardPreviousPendingHTML;

    } else if (
        $("dashboardTable")
    ) {

        $("dashboardTable").insertAdjacentHTML(
            "beforebegin",
            dashboardPreviousPendingHTML
        );

    }


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

                <th class="num">
                    Previous Pending
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
                                            previousPending > 0.005

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
                                            row.status === "ON LEAVE"
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

                <th>Salary From</th>

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
                                    ${
                                        transaction.type === "salary" &&
                                        transaction.salaryStartDate
                                            ?
                                        escapeHTML(
                                            transaction.salaryStartDate
                                        )
                                            :
                                        "-"
                                    }
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
                            colspan="7"
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


    const previousPendingRows =
        state.employees
            .map(
                employee => {

                    const pending =
                        getPreviousPendingSalary(
                            employee,
                            month
                        );

                    return {
                        employee,
                        pending
                    };

                }
            )
            .filter(
                row =>
                    row.pending > 0.005
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

                            <tfoot>

                                <tr>

                                    <th>
                                        Total Previous Pending
                                    </th>

                                    <th class="num">
                                        ${money(
                                            totalPreviousPending
                                        )}
                                    </th>

                                </tr>

                            </tfoot>

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

        existingPreviousPending.outerHTML =
            `
                <div id="previousPendingReport">
                    ${previousPendingHTML}
                </div>
            `;

    } else if (
        $("reportTable")
    ) {

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
        formatDateInput(
            new Date()
        );


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
                    for the selected month.
                    Example: if the employee returns from
                    vacation on 20 August, select 20 August.
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
    salaryStartDate,
    transactionDate
) {

    if (
        type !== "salary"
    ) {

        return true;

    }


    if (
        !salaryStartDate
    ) {

        return true;

    }


    if (
        monthKey(
            salaryStartDate
        ) !==
        monthKey(
            transactionDate
        )
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
                    salaryStartDate,
                    date
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
                    salaryStartDate,
                    date
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
                parseDateOnly(endDate) <
                parseDateOnly(startDate)
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
                parseDateOnly(endDate) <
                parseDateOnly(startDate)
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
   ORIGINAL PRINT BEHAVIOUR RETAINED

   IMPORTANT:
   No selected-month print-date modification.
===================================================== */

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
