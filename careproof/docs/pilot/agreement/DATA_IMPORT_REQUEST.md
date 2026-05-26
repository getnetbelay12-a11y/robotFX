# CareProof Pilot Data Import Request

To prepare your pilot environment, please provide CSV files using the templates below.

## Required Files

- `caregivers.csv`
- `clients.csv`
- `family_members.csv`
- `visits.csv`

## Caregivers CSV

Required columns:

`firstName,lastName,email,phone,language,status`

## Clients CSV

Required columns:

`firstName,lastName,dateOfBirth,addressLine1,city,state,zip,primaryCaregiverEmail,status,riskLevel`

## Family Members CSV

Required columns:

`clientFirstName,clientLastName,clientDateOfBirth,firstName,lastName,email,phone,relationship,preferredContactMethod`

## Visits CSV

Required columns:

`clientFirstName,clientLastName,clientDateOfBirth,caregiverEmail,scheduledStart,scheduledEnd,carePlanTemplate,status`

## Notes

Please do not include unnecessary sensitive medical information in the import files. For the first pilot, keep the information limited to what is needed to run the visit workflow and family update process.
